import type { CriaSexo, Sexo } from '../types';

type Props = {
  sexo: Sexo;
  criaSexo?: CriaSexo | null;
  showLabel?: boolean;
};

const FULL_LABEL: Record<Sexo, string> = {
  VP: 'Vaca parida',
  HV: 'Hembra de vientre',
  HL: 'Hembra de levante',
  ML: 'Macho de levante',
  MC: 'Macho de ceba',
  TO: 'Toro',
};

export function SexoBadge({ sexo, criaSexo, showLabel = false }: Props) {
  const cls = `badge is-${sexo.toLowerCase()}`;
  return (
    <span className={cls} title={FULL_LABEL[sexo]}>
      <span>{sexo}</span>
      {criaSexo && <span aria-label={`cría ${criaSexo === 'M' ? 'macho' : 'hembra'}`}>+{criaSexo}</span>}
      {showLabel && <span style={{ fontWeight: 400, opacity: 0.85 }}>· {FULL_LABEL[sexo]}</span>}
    </span>
  );
}
