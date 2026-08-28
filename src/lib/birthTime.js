// Resolve the wall-clock time against the runtime's IANA database. Never let
// Moment silently normalize a nonexistent hour or pick one occurrence twice.
export function resolveBirthInstant({ date, time, timezone, utcOffsetMinutes }) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { throw new Error('O fuso desta cidade não é válido. Selecione novamente o local.'); }
  const wall = Date.parse(`${date}T${time}:00Z`);
  const at = (epoch) => Object.fromEntries(formatter.formatToParts(new Date(epoch))
    .filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const offsetAt = (epoch) => {
    const p = at(epoch);
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - epoch) / 60000;
  };
  const offsets = new Set();
  for (let hours = -48; hours <= 48; hours += 6) offsets.add(offsetAt(wall + hours * 3600000));
  const matches = [...offsets].map((offset) => ({ offset, epoch: wall - offset * 60000 }))
    .filter(({ epoch }) => {
      const p = at(epoch);
      return `${p.year}-${p.month}-${p.day}` === date && `${p.hour}:${p.minute}` === time && p.second === '00';
    }).sort((a, b) => a.epoch - b.epoch);
  if (!matches.length) throw new Error('Esse horário não existiu nessa cidade devido à mudança do horário de verão. Confira o horário registrado antes de continuar.');
  const explicit = utcOffsetMinutes !== '' && utcOffsetMinutes !== undefined && utcOffsetMinutes !== null;
  const chosen = explicit ? matches.find((match) => match.offset === Number(utcOffsetMinutes)) : matches.length === 1 ? matches[0] : null;
  if (!chosen) {
    if (matches.length === 1) throw new Error('O deslocamento de fuso informado não corresponde a essa cidade e data. Confirme novamente os dados.');
    const error = new Error('Esse horário ocorreu duas vezes na mudança do horário de verão. Confirme abaixo qual ocorrência consta no registro de nascimento.');
    error.offsetOptions = matches.map((match, index) => ({ minutes: match.offset,
      label: `${index + 1}ª ocorrência · UTC${match.offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(match.offset) / 60)).padStart(2, '0')}:${String(Math.floor(Math.abs(match.offset) % 60)).padStart(2, '0')}` }));
    throw error;
  }
  return { date: new Date(chosen.epoch), offset: chosen.offset, ambiguous: matches.length > 1 };
}
