import { Observable, of, isObservable, combineLatest, BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged, switchMap, reduce } from 'rxjs/operators'
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

export type Selectable<T> = {
  select: <TKey extends keyof T>(key: TKey) => State<T[TKey]>
}

export type State<T> = Observable<T> & Reducable<T> & Selectable<T>

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

function createItemState<T>(item: T, source: State<T[]>): State<T> {
  const reducable = Object.assign(of(item), {
    // reduce: (reducer: Reducer<T>) => {
    //   const nextValue = reducer(item);
    //   if (nextValue === item) {
    //     return;
    //   }

    //   source.reduce(items => items.map(x => x === item ? nextValue : x));
    // }
    reduce: (reducer: Reducer<T>) =>
      source.reduce(items => {
        const nextValueOrPromise = reducer(item);

        return Promise.resolve(nextValueOrPromise)
          .then(nextValue => {
            if (nextValue === item) {
              return items;
            } else {
              return source.reduce(items => items.map(x => x === item ? nextValue : x))
            }
          })
      }).then(_ => item)
  });
  
  const selectable = Object.assign(reducable, {
    select: <TKey extends keyof T>(key: TKey) => select(reducable, key)
  });

  return selectable;
}

export function mapItems<T, U>(itemsState: State<T[]>, mapping: (itemState: State<T>, index: number) => U): Observable<Observable<U>[]> {
  const out = itemsState.pipe(
    switchMap(items => {
      const itemStates = items.map((item, index) => 
        createState(item, reduced => {
          if (reduced === item) {
            return item;
          } else {
            return itemsState.reduce(currentItems => currentItems.map(x => x === item ? reduced : x))
              .then(_ => reduced);
          }
        }));

      const mappedItems = itemStates.map((item, index) => mapping(item, index));

      return makeItemsObservable(mappedItems);
    })
  );

  return out;
  // const out = itemsState.pipe(
  //   switchMap(items => {
  //     const mappedItems = items.map((item, index) => mapping(createItemState(item, itemsState), index));
  //     return makeItemsObservable(mappedItems);
  //   })
  // );

  // return out;
};