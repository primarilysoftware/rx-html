import { Observable, of, isObservable, combineLatest, BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged, switchMap, reduce, filter } from 'rxjs/operators'
import { html as litHtml, TemplateResult } from 'lit-html';

function makeObservable<T>(arg: T): Observable<unknown> {
  if (isObservable(arg)) {
    return arg;
  } else if (Array.isArray(arg)) {
    return makeItemsObservable(arg);
  } else {
    return of(arg);
  }
};

function makeItemsObservable<T>(args: T[]): Observable<Observable<T>[]> {
  if (!args || args.length === 0) {
    return of([]);
  }

  return combineLatest(...args.map(item => makeObservable(item)));
};

export function html(parts: TemplateStringsArray, ...args: any[]): Observable<TemplateResult> {
  return makeItemsObservable(args).pipe(
    map(latest => litHtml(parts, ...latest)),
  );
};

export type Reducer<T> = (current: T) => T | Promise<T>;

export type Reducable<T> = {
  reduce: (reducer: Reducer<T>) => Promise<T>
}

export type ReduceHandler<T> = (current: T, reducer: Reducer<T>) => T | Promise<T>

export type Selectable<T> = {
  select: <TKey extends keyof T>(key: TKey) => State<T[TKey]>
}

export type State<T> = Observable<T> & Reducable<T> & Selectable<T>

export function createState<T>(initialValue: T, reduceHandler?: ReduceHandler<T>) {
  const subject = new BehaviorSubject(initialValue);
  let pendingChanges = Promise.resolve(initialValue);

  const reducable = Object.assign(subject, {
    reduce: (reducer: Reducer<T>) => {
      pendingChanges = Promise.resolve(pendingChanges)
        .then(current => {
          if (reduceHandler) {
            return reduceHandler(current, reducer);
          } else {
            return Promise.resolve(reducer(current)).then(next => {
              if (subject.value !== next) {
                subject.next(next);
              }

              return next;
            })
          }
        });

      return pendingChanges;
    }
  });

  const selectable = Object.assign(reducable, {
    select: <TKey extends keyof T>(key: TKey) => select(reducable, key)
  });

  return selectable;
}

export function select<T, TKey extends keyof T>(source: Observable<T> & Reducable<T>, key: TKey): State<T[TKey]> {
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

export function mapItems<T, U>(itemsState: State<T[]>, mapping: (itemState: State<T>, index: number) => U): Observable<Observable<U>[]> {
  const out = itemsState.pipe(
    filter(items => items !== undefined),
    switchMap(items => {
      const itemStates = items.map((item, index) => 
        createState(item, (current, reducer) =>
          Promise.resolve(reducer(current))
            .then(next => {
              if (next === item) {
                return item;
              } else {
                return itemsState.reduce(currentItems => currentItems.map(x => x === item ? next : x))
                  .then(_ => next);
              }
            })));

      const mappedItems = itemStates.map((item, index) => mapping(item, index));

      return makeItemsObservable(mappedItems);
    })
  );

  return out;
};