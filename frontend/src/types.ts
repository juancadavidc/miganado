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

export type UsuarioMini = {
  id: string;
  nombre: string;
  documento: string;
};

export type TrasladoRol = 'DUENO' | 'CUIDADOR';
export type TrasladoEstado = 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'CANCELADO';

export type TrasladoLoteResumen = {
  id: string;
  fecha: string;
  numeroFeria: string | null;
  loteNumero: string | null;
  sexo: Sexo;
  cantidad: number;
  dueno?: UsuarioMini;
  cuidador?: UsuarioMini | null;
};

export type Traslado = {
  id: string;
  loteId: string;
  rol: TrasladoRol;
  estado: TrasladoEstado;
  mensaje: string | null;
  createdAt: string;
  respondidoAt: string | null;
  para?: UsuarioMini;
  creadoPor?: UsuarioMini;
  lote?: TrasladoLoteResumen;
};

export type Finca = {
  id: string;
  nombre: string;
  capacidad: number; // 16 | 32 | 64 — ancho del mapa en columnas
  propiedades: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  _count?: { potreros: number };
};

export type Potrero = {
  id: string;
  fincaId: string;
  nombre: string;
  ocupado: boolean;
  ocupadoDesde: string | null;
  vacioDesde: string | null;
  notas: string | null;
  metadatos: Record<string, string> | null;
  gridX: number | null;
  gridY: number | null;
  gridW: number;
  gridH: number;
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
  dueno?: UsuarioMini;
  cuidador?: UsuarioMini | null;
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
  traslados?: Traslado[];
};
