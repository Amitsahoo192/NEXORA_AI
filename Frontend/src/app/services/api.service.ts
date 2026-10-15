
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export const API_BASE = 'https://nexora-aqr7.onrender.com';

export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
}

export interface ChatItem {
  _id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) {}

  // Get the saved authentication token
  token(): string | null {
    return localStorage.getItem('token');
  }

  // Add the authentication token to request headers
  headers(): HttpHeaders {
    const token = this.token();

    return new HttpHeaders(
      token
        ? { Authorization: `Bearer ${token}` }
        : {}
    );
  }

  // Login an existing user
  async login(
    email: string,
    password: string
  ): Promise<any> {
    const data: any = await firstValueFrom(
      this.http.post(
        `${API_BASE}/api/auth/login`,
        {
          email,
          password
        }
      )
    );

    if (data.token) {
      localStorage.setItem('token', data.token);
    }

    return data;
  }

  // Register a new user
  async register(
    name: string,
    email: string,
    password: string
  ): Promise<any> {
    return firstValueFrom(
      this.http.post(
        `${API_BASE}/api/auth/register`,
        {
          name,
          email,
          password
        }
      )
    );
  }

  // Get the currently authenticated user
  async me(): Promise<any> {
    return firstValueFrom(
      this.http.get(
        `${API_BASE}/api/auth/me`,
        {
          headers: this.headers()
        }
      )
    );
  }

  // Fetch the user's chat history
  async chats(): Promise<ChatItem[]> {
    return firstValueFrom(
      this.http.get<ChatItem[]>(
        `${API_BASE}/api/chats`,
        {
          headers: this.headers()
        }
      )
    );
  }

  // Send a message and receive an AI response
  async send(
    messages: ChatMessage[],
    chatId: string | null,
    documentId: string | null
  ): Promise<any> {
    return firstValueFrom(
      this.http.post(
        `${API_BASE}/api/chats`,
        {
          chatId,
          messages,
          documentId
        },
        {
          headers: this.headers()
        }
      )
    );
  }

  // Delete a chat
  async deleteChat(id: string): Promise<any> {
    return firstValueFrom(
      this.http.delete(
        `${API_BASE}/api/chats/${id}`,
        {
          headers: this.headers()
        }
      )
    );
  }

  // Upload a PDF document for RAG
  async upload(file: File): Promise<any> {
    const form = new FormData();

    form.append('document', file);

    return firstValueFrom(
      this.http.post(
        `${API_BASE}/upload-document`,
        form,
        {
          headers: this.headers()
        }
      )
    );
  }

  // Analyze a resume
  async analyzeResume(file: File): Promise<any> {
    const form = new FormData();

    form.append('resume', file);

    return firstValueFrom(
      this.http.post(
        `${API_BASE}/api/resume/analyze`,
        form,
        {
          headers: this.headers()
        }
      )
    );
  }

  // Log out the current user
  logout(): void {
    localStorage.removeItem('token');
  }
}
