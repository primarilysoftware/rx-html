import { BehaviorSubject, Observable } from "rxjs";
import { map, filter } from "rxjs/operators";

export type Reducer<T> = (currentValue: T) => T;

export type Reducable<T> = {
  reduce: (reducer: Reducer<T>) => void;
};

export type Selectable<T> = {
  select: <TKey extends keyof T>(key: TKey) => State<T[TKey]>
};

export type State<T> = Observable<T> & Reducable<T> & Selectable<T>;

export function createState<T>(initialValue: T): State<T> {
  const subject = new BehaviorSubject(initialValue);

  const reducable = Object.assign(subject, {
    reduce: (reducer: Reducer<T>) => subject.next(reducer(subject.value))
  });

  return Object.assign(reducable, {
    select: <TKey extends keyof T>(key: TKey) => select(reducable, key)
  });
}

function select<T, TKey extends keyof T>(source: Observable<T> & Reducable<T>, key: TKey): State<T[TKey]> {
  const observable = source.pipe(
    filter(value => value !== null && value !== undefined),
    map(value => value[key])
  );

  const reducable = Object.assign(observable, {
    reduce: (reducer: Reducer<T[TKey]>) => {
      source.reduce(value => {
        if (value == null || value == undefined) {
          return value;
        }

        return {
          ...value,
          [key]: reducer(value[key])
        };
      });
    }
  });

  return Object.assign(reducable, {
    select: <TSubKey extends keyof T[TKey]>(subKey: TSubKey) => select(reducable, subKey)
  });
}