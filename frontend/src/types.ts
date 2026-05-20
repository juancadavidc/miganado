export type Sexo = 'VP' | 'HV' | 'HL' | 'ML' | 'MC' | 'TO';
export type CriaSexo = 'M' | 'H';

export const SEXO_LABELS: Record<Sexo, string> = {
  VP: 'Vaca parida (VP)',
  HV: 'Hembra de vientre / novilla (HV)',
  HL: 'Hembra de levante / ternera (HL)',
  ML: 'Macho de levante / ternero (ML)',
  MC: 'Macho de ceba (MC)',
  TO: 'Toro (TO)',
};

export const SEXO_SHORT: Record<Sexo, string> = {
  VP: 'VP',
  HV: 'HV',
  HL: 'HL',
  ML: 'ML',
  MC: 'MC',
  TO: 'TO',
};

export const CRIA_SEXO_LABELS: Record<CriaSexo, string> = {
  M: 'Macho',
  H: 'Hembra',
};

export type User = {
  id: string;
  documento: string;
  nombre: string;
  createdAt?: string;
};

export type Potrero = {
  id: string;
  nombre: string;
  ocupado: boolean;
  ocupadoDesde: string | null;
  vacioDesde: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Anotacion = {
  id: string;
  loteId: string | null;
  animalId: string | null;
  gastoId: string | null;
  texto: string;
  createdAt: string;
  updatedAt: string;
};

export type Lote = {
  id: string;
  fecha: string;
  numeroFeria: string | null;
  loteNumero: string | null;
  sexo: Sexo;
  cantidad: number;
  pesoTotal: string;
  pesoPromedio: string | null;
  valorFinal: string;
  valorTotal: string;
  deduccion: string;
  referencia: string | null;
  valorAPagar: string;
  criasMacho: number;
  criasHembra: number;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { animales: number; fotos: number; gastos: number };
};

export type Animal = {
  id: string;
  loteId: string;
  identificador: string | null;
  sexo: Sexo;
  peso: string | null;
  criaSexo: CriaSexo | null;
  notas: string | null;
  fotos?: Foto[];
  anotaciones?: Anotacion[];
};

export type Gasto = {
  id: string;
  loteId: string;
  descripcion: string;
  monto: string;
  fecha: string;
  anotaciones?: Anotacion[];
};

export type Foto = {
  id: string;
  loteId: string | null;
  animalId: string | null;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
  url: string;
};

export type LoteDetalle = Lote & {
  animales: Animal[];
  gastos: Gasto[];
  fotos: Foto[];
  anotaciones: Anotacion[];
};
