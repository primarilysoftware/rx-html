import { Observable, combineLatest, isObservable, of } from 'rxjs';
import { map } from 'rxjs/operators'
import { TemplateResult, html as litHtml } from 'lit-html';

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

export function html(parts: TemplateStringsArray, ...args: unknown[]): Observable<TemplateResult> {
    return makeItemsObservable(args).pipe(
        map(latest => litHtml(parts, ...latest))
    );
};