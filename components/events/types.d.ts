export interface ListeroData {
  _id: string;
  asisten: number;
  createdAt: Date;
  eventId: string;
  inscritos: number;
  userId: {
    _id: string;
    email: string;
    role: string;
    name: string;
  }
  updatedAt: Date;
}

export interface RankingData {
  name: string;
  total: number;
}