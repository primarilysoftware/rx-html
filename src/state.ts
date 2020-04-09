import { Observable, BehaviorSubject } from "rxjs";
import { map } from "rxjs/operators";

export type Reducer<T> = (current: T) => T | Promise<T>;

export type Reducable<T> = {
  reduce: (reducer: Reducer<T>) => Promise<T>
}

export type Selectable<T> = {
  select: <TKey extends keyof T>(key: TKey) => State<T[TKey]>
}

export type State<T> = Observable<T>

export function createState<T>(initialValue: T, reducer?: Reducer<T>) {
  const subject = new BehaviorSubject(initialValue);

  const reducable = Object.assign(subject, {
    reduce: (red: Reducer<T>) => {
      const nextValueOrPromise = red(subject.value);

      return Promise.resolve(nextValueOrPromise)
        .then(nextValue => {
          if (nextValue === subject.value) {
            return subject.value;
          } else {
            return Promise.resolve(reducer ? reducer(nextValue) : nextValue)
              .then(reducedValue => {
                subject.next(reducedValue);
                return reducedValue;
              })
          }
        });
    }
  });

  const selectable = Object.assign(reducable, {
    select: <TKey extends keyof T>(key: TKey) => select(reducable, key)
  });

  return selectable;
}

export function select<T, TKey extends keyof T>(source: Observable<T> & Reducable<T>, key: TKey): State<T[TKey]> {
  const observable = source.pipe(
    map(val => val[key])
  );

  const reducable = Object.assign(observable, {
    reduce: (reducer: Reducer<T[TKey]>) => 
      source.reduce(current => {
        const next = reducer(current[key]);

        return Promise.resolve(next).then(nextValue => {
          if (nextValue !== current[key]) {
            return {
              ...current,
              [key]: nextValue
            }
          } else {
            return current
          }
        });
      }).then(val => val[key])
  });

  const selectable = Object.assign(reducable, {
    select: <TSubKey extends keyof T[TKey]>(subKey: TSubKey) => select<T[TKey], TSubKey>(reducable, subKey)
  });

  return selectable;
}