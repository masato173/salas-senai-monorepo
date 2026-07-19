import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

// Valida que a data (YYYY-MM-DD) não é anterior a hoje.
// Usa UTC noon trick para evitar problemas de fuso horário (Manaus UTC-4) —
// mesma convenção usada no resto do projeto (expandirDatas, sync).
@ValidatorConstraint({ name: 'isNotPastDate', async: false })
export class IsNotPastDateConstraint implements ValidatorConstraintInterface {
  validate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return true; // deixa o @Matches cuidar do formato
    }
    const inputDate = new Date(`${date}T12:00:00Z`);
    const today = new Date();
    const todayYmd = today.toISOString().slice(0, 10);
    const todayNoon = new Date(`${todayYmd}T12:00:00Z`);
    return inputDate.getTime() >= todayNoon.getTime();
  }

  defaultMessage(args: ValidationArguments): string {
    return `date "${args.value}" não pode ser uma data no passado.`;
  }
}
