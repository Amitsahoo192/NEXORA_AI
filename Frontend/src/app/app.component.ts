
import {
  Component,
  OnInit,
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
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {

  @ViewChild('fileInput')
  fileInput?: ElementRef<HTMLInputElement>;

  @ViewChild('resumeInput')
  resumeInput?: ElementRef<HTMLInputElement>;

  user: any = null;

  authLoading = true;
  isRegister = false;
  busy = false;
  uploadBusy = false;
  resumeBusy = false;

  email = '';
  password = '';
  name = '';
  input = '';
  error = '';
  notice = '';

  mode: 'chat' | 'resume' | 'settings' | 'help' = 'chat';

  messages: ChatMessage[] = [];
  chats: ChatItem[] = [];

  chatId: string | null = null;
  selectedDocument: any = null;
  resumeFile: File | null = null;
  resumeResult: any = null;

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    if (this.api.token()) {
      try {
        const data = await this.api.me();

        this.user = data.user || data;
        await this.loadChats();
      } catch {
        this.api.logout();
      }
    }

    this.authLoading = false;

    const prompt = localStorage.getItem('nexora_resume_prompt');

    if (prompt) {
      this.input = prompt;
      localStorage.removeItem('nexora_resume_prompt');
    }
  }

  // Render AI messages as safe, formatted Markdown.
  formatMessage(text: string): string {
    const markdown = marked.parse(text || '') as string;
    return DOMPurify.sanitize(markdown);
  }

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
  }  async loadChats(): Promise<void> {
    try {
      this.chats = await this.api.chats();
    } catch (e) {
      console.warn('Could not load chats', e);
    }
  }
  newChat(): void {
    this.chatId = null;
    this.messages = [];
    this.selectedDocument = null;
    this.input = '';
    this.mode = 'chat';
    this.error = '';
  }
  openChat(chat: ChatItem): void {
    this.chatId = chat._id;
    this.messages = [...(chat.messages || [])];
    this.mode = 'chat';
    this.selectedDocument = null;
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
        e?.error?.message ||
        'Could not delete chat.';
    }
  }

  async send(): Promise<void> {
    const text = this.input.trim();

    if (!text || this.busy) {
      return;
    }

    const prior = [...this.messages];

    const next: ChatMessage[] = [
      ...prior,
      {
        sender: 'user',
        text
      }
    ];

    this.messages = next;
    this.input = '';
    this.busy = true;
    this.error = '';

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

      await this.loadChats();
    } catch (e: any) {
      this.messages = prior;
      this.input = text;

      this.error =
        e?.error?.message ||
        'Could not generate a response. Check the backend and API keys.';
    } finally {
      this.busy = false;
    }
  }

  onComposerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  chooseDocument(): void {
    this.fileInput?.nativeElement.click();
  }

  async uploadDocument(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      this.error = 'Please choose a PDF document.';
      input.value = '';
      return;
    }

    this.uploadBusy = true;
    this.error = '';

    try {
      this.selectedDocument = await this.api.upload(file);

      this.notice =
        `${file.name} uploaded and indexed ` +
        `(${this.selectedDocument.chunks ?? 0} chunks).`;
    } catch (e: any) {
      this.error =
        e?.error?.message ||
        'Document upload failed.';
    } finally {
      this.uploadBusy = false;
      input.value = '';
    }
  }

  onResumeSelected(event: Event): void {
    this.resumeFile =
      (event.target as HTMLInputElement).files?.[0] || null;

    this.resumeResult = null;
  }

  async analyzeResume(): Promise<void> {
    if (!this.resumeFile) {
      this.error = 'Choose a PDF resume first.';
      return;
    }

    this.resumeBusy = true;
    this.error = '';
    this.resumeResult = null;

    try {
      const result = await this.api.analyzeResume(this.resumeFile);
      this.resumeResult = result.analysis;
    } catch (e: any) {
      this.error =
        e?.error?.message ||
        'Resume analysis failed.';
    } finally {
      this.resumeBusy = false;
    }
  }

  askNexora(recommendation: string): void {
    this.input =
      `Help me with this resume recommendation:\n\n${recommendation}`;

    this.mode = 'chat';
  }

  logout(): void {
    this.api.logout();
    this.user = null;
    this.messages = [];
    this.chats = [];
    this.newChat();
  }

  displayResult(value: any): string {
    return typeof value === 'string'
      ? value
      : JSON.stringify(value, null, 2);
  }
}
