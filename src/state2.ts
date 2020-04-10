import { Observable, BehaviorSubject } from "rxjs";
import { filter, map } from "rxjs/operators";

export type Reducer<T> = (current: T) => T | Promise<T>;

export type Reducable<T> = {
  reduce(reducer: Reducer<T>): Promise<void>
}

export type Selectable<T> = {
  select<TKey extends keyof T>(key: TKey): State<T[TKey]>
}

export type State<T> = Observable<T> & Selectable<T> & Reducable<T>;

export function createState<T>(initialState: T, defaultReducer?: Reducer<T>): State<T> {
  const subject = new BehaviorSubject(initialState);
  const reducable = makeReducable(subject, defaultReducer);
  return makeSelectable(reducable);
}

export function makeReducable<T>(subject: BehaviorSubject<T>, defaultReducer?: Reducer<T>): Observable<T> & Reducable<T> {
  let reducing: Promise<void> = Promise.resolve();

  return Object.assign(subject, {
    reduce: (reducer: Reducer<T>) => {
      reducing = reducing.then(() => Promise.resolve(reducer(subject.value))
        .then(nextValue => {
          if (subject.value === nextValue) {
            return;
          }

          if (defaultReducer) {
            return Promise.resolve(defaultReducer(nextValue))
              .then(reduced => {
                if (reduced !== subject.value) {
                  subject.next(reduced);
                }
              })
          }

          subject.next(nextValue);
        }));

        return reducing;
      }
  });
}

export function makeSelectable<T>(source: Observable<T> & Reducable<T>): State<T> {
  return Object.assign(source, {
    select: <TKey extends keyof T>(key: TKey) => {
      const observable = source.pipe(
        filter(val => val !== undefined),
        map(val => val[key])
      );

      const reducable = Object.assign(observable, {
        reduce: (reducer: Reducer<T[TKey]>) => 
          source.reduce(current => {
            if (current === undefined) {
              return current;
            }

            const next = reducer(current[key]);
            if (next === current[key]) {
              return current;
            }

            return {
              ...current,
              [key]: next
            };
          })
      });

      return makeSelectable(reducable);
    }
  });
}

export function createItemState<T>(source: State<T[]>, item: T): State<T> {
  return createState(item, current => 
    source.reduce(currentItems => currentItems.map(x => x === item ? current : x))
      .then(() => current));
}

export function mapItems<T, U>(itemsState: State<T[]>, mapping: (itemState: State<T>) => U): Observable<U[]> {
  return itemsState.pipe(
    map(items => items.map(item => createItemState(itemsState, item))),
    map(itemStates => itemStates.map(itemState => mapping(itemState)))
  );
}