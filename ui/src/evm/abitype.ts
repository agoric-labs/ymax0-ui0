import type { TypedDataType, TypedData } from 'abitype';

export type TypedDataParameter<
  TN extends string = string,
  TT = TypedDataType | keyof TypedData | `${keyof TypedData}[${string | ''}]`,
> = {
  name: TN;
  type: TT;
};
