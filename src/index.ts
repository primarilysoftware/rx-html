import { Observable, of, isObservable, combineLatest, BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators'
import { html as litHtml, TemplateResult } from 'lit-html';

export type Selectable<T> = {
  select(key: keyof T): State<T[keyof T]>
}

export type Reducer<T> = (value: T) => T;

export type Reducable<T> = {
  reduce: (reducer: Reducer<T>) => void
}

export type State<T> = Observable<T> & Reducable<T> & Selectable<T>

function makeObservable(arg: unknown): Observable<unknown> {
  if (isObservable(arg)) {
    return arg;
  } else if (Array.isArray(arg)) {
    return makeItemsObservable(arg);
  } else {
    return of(arg);
  }
};

function makeItemsObservable(args: unknown[]): Observable<Observable<unknown>[]> {
  if (!args || args.length === 0) {
    return of([]);
  }

  return combineLatest(...args.map(item => makeObservable(item)));
};

function select<T>(state: Observable<T> & Reducable<T>, key: keyof T): State<T[keyof T]> {
  const observable = state.pipe(
    map(val => val[key]),
    distinctUntilChanged()
  );

  const reduceFunc = (reducer: Reducer<T[keyof T]>) => {
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

  const selectFunc = (subKey: keyof T[keyof T]) => select(reducable, subKey);

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
    select: (key: keyof T) => select(reducable, key)
  });
}