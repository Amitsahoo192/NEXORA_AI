
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import {
  ApiService,
  ChatItem,
  ChatMessage
} from './services/api.service';

type ResponseRating = 'up' | 'down';

type RatedChatMessage = ChatMessage & {
  rating?: ResponseRating;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput')
  fileInput?: ElementRef<HTMLInputElement>;

  @ViewChild('resumeInput')
  resumeInput?: ElementRef<HTMLInputElement>;

  user: any = null;

  authLoading = true;
  isRegister = false;

  busy = false;
  chatBusy = false;
  uploadBusy = false;
  resumeBusy = false;

  // Voice input and output
  recognition: any = null;
  voiceSupported = false;
  isListening = false;
  isSpeaking = false;

  email = '';
  password = '';
  name = '';
  input = '';
  error = '';
  notice = '';

  mode: 'chat' | 'resume' | 'settings' | 'help' = 'chat';

  messages: RatedChatMessage[] = [];
  chats: ChatItem[] = [];

  chatId: string | null = null;
  selectedDocument: any = null;
  resumeFile: File | null = null;
  resumeResult: any = null;

  constructor(private api: ApiService) {}

  // ---------------- INITIALIZATION ----------------

  async ngOnInit(): Promise<void> {
    this.initializeVoice();

    try {
      if (this.api.token()) {
        try {
          const data = await this.api.me();

          this.user = data.user || data;
          await this.loadChats();
        } catch (e) {
          console.warn('Could not restore session:', e);

          this.api.logout();
          this.user = null;
        }
      }

      const prompt = localStorage.getItem('nexora_resume_prompt');

      if (prompt) {
        this.input = prompt;
        localStorage.removeItem('nexora_resume_prompt');
      }
    } finally {
      this.authLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.stopVoiceInput();
    this.stopSpeaking();
  }

  // ---------------- VOICE INPUT ----------------

  initializeVoice(): void {
    const browserWindow = window as any;

    const SpeechRecognition =
      browserWindow.SpeechRecognition ||
      browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.voiceSupported = false;
      return;
    }

    this.voiceSupported = true;
    this.recognition = new SpeechRecognition();

    this.recognition.lang = 'en-IN';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.error = '';
    };

    this.recognition.onresult = (event: any) => {
      const transcript =
        event.results[0][0].transcript.trim();

      this.input = this.input
        ? `${this.input} ${transcript}`
        : transcript;
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;

      if (event.error === 'not-allowed') {
        this.error =
          'Microphone permission denied. Allow microphone access in your browser.';
      } else if (
        event.error !== 'no-speech' &&
        event.error !== 'aborted'
      ) {
        this.error = 'Voice input failed. Please try again.';
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };
  }

  toggleVoiceInput(): void {
    if (!this.voiceSupported || this.chatBusy) {
      return;
    }

    if (this.isListening) {
      this.stopVoiceInput();
      return;
    }

    this.stopSpeaking();

    try {
      this.recognition.start();
    } catch (e) {
      console.warn('Could not start voice input:', e);
    }
  }

  stopVoiceInput(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Recognition may already have stopped.
      }
    }

    this.isListening = false;
  }

  // ---------------- VOICE OUTPUT ----------------

  speakMessage(text: string): void {
    if (!('speechSynthesis' in window)) {
      this.error =
        'Voice output is not supported in this browser.';
      return;
    }

    this.stopSpeaking();

    // Make Markdown readable when spoken aloud.
    const plainText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_~>]/g, '')
      .trim();

    if (!plainText) {
      return;
    }

    const speech = new SpeechSynthesisUtterance(plainText);

    speech.lang = 'en-IN';
    speech.rate = 1;
    speech.pitch = 1;

    speech.onstart = () => {
      this.isSpeaking = true;
    };

    speech.onend = () => {
      this.isSpeaking = false;
    };

    speech.onerror = () => {
      this.isSpeaking = false;
    };

    window.speechSynthesis.speak(speech);
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.isSpeaking = false;
  }

  // ---------------- MARKDOWN ----------------

  formatMessage(text: string): string {
    const markdown = marked.parse(text || '') as string;

    return DOMPurify.sanitize(markdown);
  }

  // ---------------- RESPONSE ACTIONS ----------------

  async copyMessage(text: string): Promise<void> {
    this.error = '';
    this.notice = '';

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for browsers without Clipboard API access.
        const textarea = document.createElement('textarea');

        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.setAttribute('readonly', '');

        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand('copy');

        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error('Copy command failed.');
        }
      }

      this.notice = 'Response copied to clipboard.';
    } catch (e) {
      console.warn('Could not copy response:', e);
      this.error = 'Unable to copy the response. Please try again.';
    }
  }

  rateResponse(
    message: RatedChatMessage,
    rating: ResponseRating
  ): void {
    // Clicking the selected rating again removes it.
    message.rating =
      message.rating === rating ? undefined : rating;
  }

  // ---------------- AUTHENTICATION ----------------

  async submitAuth(): Promise<void> {
    this.error = '';
    this.notice = '';

    if (!this.email.trim() || !this.password) {
      this.error = 'Email and password are required.';
      return;
    }

    if (this.isRegister && !this.name.trim()) {
      this.error = 'Please enter your name.';
      return;
    }

    this.busy = true;

    try {
      if (this.isRegister) {
        await this.api.register(
          this.name.trim(),
          this.email.trim(),
          this.password
        );

        this.notice = 'Account created. Please log in.';
        this.isRegister = false;
        this.password = '';
      } else {
        const data = await this.api.login(
          this.email.trim(),
          this.password
        );

        this.user = data.user || {
          email: this.email,
          name: this.email.split('@')[0]
        };

        await this.loadChats();
      }
    } catch (e: any) {
      this.error =
        e?.error?.message ||
        e?.message ||
        'Authentication failed. Check the backend connection.';
    } finally {
      this.busy = false;
    }
  }

  // ---------------- CHAT HISTORY ----------------

  async loadChats(): Promise<void> {
    try {
      this.chats = await this.api.chats();
    } catch (e) {
      console.warn('Could not load chats:', e);
    }
  }

  newChat(): void {
    this.stopVoiceInput();
    this.stopSpeaking();

    this.chatId = null;
    this.messages = [];
    this.selectedDocument = null;
    this.input = '';
    this.mode = 'chat';
    this.error = '';
    this.notice = '';
  }

  openChat(chat: ChatItem): void {
    this.stopVoiceInput();
    this.stopSpeaking();

    this.chatId = chat._id;
    this.messages = [...(chat.messages || [])] as RatedChatMessage[];
    this.mode = 'chat';
    this.selectedDocument = null;
    this.error = '';
    this.notice = '';
  }

  async removeChat(
    chat: ChatItem,
    event: Event
  ): Promise<void> {
    event.stopPropagation();

    if (!confirm(`Delete "${chat.title || 'this chat'}"?`)) {
      return;
    }

    try {
      await this.api.deleteChat(chat._id);

      if (this.chatId === chat._id) {
        this.newChat();
      }

      await this.loadChats();
    } catch (e: any) {
      this.error =
        e?.error?.message || 'Could not delete chat.';
    }
  }

  // ---------------- SEND MESSAGE ----------------

  async send(): Promise<void> {
    const text = this.input.trim();

    if (!text || this.chatBusy) {
      return;
    }

    this.stopVoiceInput();
    this.stopSpeaking();

    const prior = [...this.messages];

    const next: RatedChatMessage[] = [
      ...prior,
      { sender: 'user', text }
    ];

    this.messages = next;
    this.input = '';
    this.chatBusy = true;
    this.error = '';
    this.notice = '';

    try {
      const result = await this.api.send(
        next,
        this.chatId,
        this.selectedDocument?.documentId || null
      );

      this.messages = [
        ...next,
        {
          sender: 'assistant',
          text: result.message || 'No response returned.'
        }
      ];

      this.chatId = result.chatId || this.chatId;

      // Refresh chat history without blocking the UI.
      void this.loadChats();
    } catch (e: any) {
      this.messages = prior;
      this.input = text;

      this.error =
        e?.error?.message ||
        e?.message ||
        'Could not generate a response. Check the backend and API keys.';
    } finally {
      // Always stop the thinking indicator after success or failure.
      this.chatBusy = false;
    }
  }

  onComposerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  // ---------------- DOCUMENT UPLOAD ----------------

  chooseDocument(): void {
    this.fileInput?.nativeElement.click();
  }

  async uploadDocument(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.error = '';
    this.notice = '';

    if (file.type !== 'application/pdf') {
      this.error = 'Please choose a PDF document.';
      input.value = '';
      return;
    }

    this.uploadBusy = true;

    try {
      this.selectedDocument = await this.api.upload(file);

      this.notice =
        `${file.name} uploaded and indexed ` +
        `(${this.selectedDocument.chunks ?? 0} chunks).`;
    } catch (e: any) {
      this.error =
        e?.error?.message || 'Document upload failed.';
    } finally {
      this.uploadBusy = false;
      input.value = '';
    }
  }

  // ---------------- RESUME ANALYZER ----------------

  onResumeSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.resumeFile = input.files?.[0] || null;
    this.resumeResult = null;
    this.error = '';
    this.notice = '';
  }

  async analyzeResume(): Promise<void> {
    if (!this.resumeFile) {
      this.error = 'Choose a PDF resume first.';
      return;
    }

    if (this.resumeFile.type !== 'application/pdf') {
      this.error = 'Please choose a PDF resume.';
      return;
    }

    this.resumeBusy = true;
    this.error = '';
    this.notice = '';
    this.resumeResult = null;

    try {
      const result = await this.api.analyzeResume(this.resumeFile);
      this.resumeResult = result.analysis;
    } catch (e: any) {
      this.error =
        e?.error?.message || 'Resume analysis failed.';
    } finally {
      this.resumeBusy = false;
    }
  }

  askNexora(recommendation: string): void {
    this.input =
      `Help me with this resume recommendation:\n\n${recommendation}`;

    this.mode = 'chat';
  }

  // ---------------- LOGOUT ----------------

  logout(): void {
    this.stopVoiceInput();
    this.stopSpeaking();

    this.api.logout();

    this.user = null;
    this.messages = [];
    this.chats = [];

    this.newChat();
  }

  // ---------------- UTILITIES ----------------

  displayResult(value: any): string {
    return typeof value === 'string'
      ? value
      : JSON.stringify(value, null, 2);
  }
}
