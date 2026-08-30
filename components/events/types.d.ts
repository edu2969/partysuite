export interface ListeroData {
  _id: string;
  asisten: number;
  createdAt: Date;
  eventoId: string;
  inscritos: number;
  rpId: {
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