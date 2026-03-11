export type Gender = 'Male' | 'Female';
export type Preference = 'Male' | 'Female' | 'Random';
export type ChatState = 'idle' | 'waiting' | 'matched' | 'disconnected';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'stranger' | 'system';
}
