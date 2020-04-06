import { Observable, of, isObservable, combineLatest, BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged, switchMap } from 'rxjs/operators'
import { html as litHtml, TemplateResult } from 'lit-html';

export type Selectable<T> = {
  select<TKey extends keyof T>(key: TKey): State<T[TKey]>
}

export type Reducer<T> = (value: T) => T;

export type Reducable<T> = {
  reduce: (reducer: Reducer<T>) => void
}

export type State<T> = Observable<T> & Reducable<T> & Selectable<T>

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

function select<T, TKey extends keyof T>(state: Observable<T> & Reducable<T>, key: TKey): State<T[TKey]> {
  const observable = state.pipe(
    map(val => val[key]),
    distinctUntilChanged()
  );

  const reduceFunc = (reducer: Reducer<T[TKey]>) => {
    return state.reduce(value => {
      const nextValue = reducer(value[key]);
      if (nextValue !== value[key]) {
        // only return a new value if there has been a change
        return {
          ...value,
          [key]: nextValue
        };
      } else {
        return value;
      }
    });
  };

  const reducable = Object.assign(observable, { reduce: reduceFunc });

  const selectFunc = <TSubKey extends keyof T[TKey]>(subKey: TSubKey) => select<T[TKey], TSubKey>(reducable, subKey);

  return Object.assign(reducable, { select: selectFunc });
}

export function html(parts: TemplateStringsArray, ...args: any[]): Observable<TemplateResult> {
  return makeItemsObservable(args).pipe(
    map(latest => litHtml(parts, ...latest)),
  );
};

export function createState<T>(initialValue: T): State<T> {
  const subject = new BehaviorSubject<T>(initialValue);

  const reducable = Object.assign(
    subject, {
      reduce: (reducer: Reducer<T>) => {
        const nextValue = reducer(subject.value);
        if (nextValue !== subject.value) {
          // only push a new value if there has been a change
          subject.next(reducer(subject.value));
        }
      }
    }
  )

  return Object.assign(reducable, {
    select: <TKey extends keyof T>(key: TKey) => select(reducable, key)
  });
}

function createItemState<T>(item: T, source: State<T[]>): State<T> {
  const reducable = Object.assign(of(item), {
    reduce: (reducer: Reducer<T>) => {
      const nextValue = reducer(item);
      if (nextValue === item) {
        return;
      }

      source.reduce(items => items.map(x => x === item ? nextValue : x));
    }
  });
  
  const selectable = Object.assign(reducable, {
    select: <TKey extends keyof T>(key: TKey) => select(reducable, key)
  });

  return selectable;
}

export function mapItems<T, U>(itemsState: State<T[]>, mapping: (itemState: State<T>, index: number) => U): Observable<Observable<U>[]> {
  const out = itemsState.pipe(
    switchMap(items => {
      const mappedItems = items.map((item, index) => mapping(createItemState(item, itemsState), index));
      return makeItemsObservable(mappedItems);
    })
  );

  return out;
};