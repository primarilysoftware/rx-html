import { html } from './html';
import { take } from 'rxjs/operators';
import { TemplateResult, render } from 'lit-html';
import { Subject } from 'rxjs';
import { SubSink } from 'subsink';

const subSink = new SubSink();

afterEach(() => subSink.unsubscribe());

describe('html', () => {
    it('should return observable that emits renderable template results', () => {
        const template$ = html`i am a template`;

        subSink.sink = template$.subscribe(result => render(result, document.body));
        
        expect(document.body.textContent).toEqual('i am a template');
    });

    describe('given template with no values', () => {
        it('should return observable that always emits the same html', () => {
            const results = new Set<string>();
            const template$ = html`i have no values`;

            subSink.sink = template$.subscribe(result => results.add(result.getHTML()));
            subSink.sink = template$.subscribe(result => results.add(result.getHTML()));

            expect(results.size).toBe(1);
            expect(results.has('i have no values')).toBe(true);
        })
    });

    describe('given template with a const value', () => {
        it('should return observable with const value inserted into template result', () => {
            const results = new Array<TemplateResult>();
            const value = 999;
            const template$ = html`i have ${value} value`;

            subSink.sink = template$.subscribe(result => results.push(result));

            expect(results.length).toBe(1);
            expect(results[0].values.length).toBe(1);
            expect(results[0].values[0]).toBe(value);
            expect(results[0].strings.length).toBe(2);
            expect(results[0].strings[0]).toBe('i have ');
            expect(results[0].strings[1]).toBe(' value');
        })
    });

    describe('given template with observable value', () => {
        it('should return observable that emits template result with latest value from observable value', () => {
            const results = new Array<TemplateResult>();
            const observableValue = new Subject<number>();
            const template$ = html`i have ${observableValue} value`;

            subSink.sink = template$.subscribe(result => results.push(result));

            // until the observable value emits something, the template observable should not emit anything
            expect(results.length).toBe(0);

            // send the first value...
            observableValue.next(1);
            expect(results.length).toBe(1);
            expect(results[0].values.length).toBe(1);
            expect(results[0].values[0]).toBe(1);

            // send another value...
            observableValue.next(2);
            expect(results.length).toBe(2);
            expect(results[1].values.length).toBe(1);
            expect(results[1].values[0]).toBe(2);
        });
    });

    describe('given template with value that is an array of observable items', () => {
        it('should return observable that emits template result with latest value from each item in array', () => {
            const results = new Array<TemplateResult>();
            const array = [
                new Subject<string>(),
                new Subject<string>()
            ];

            const template$ = html`i have these items: ${array}`;
            subSink.sink = template$.subscribe(result => results.push(result));

            // until all items in the array emit something, the template observable should not emit anything
            expect(results.length).toBe(0);

            array[0].next('item 1');

            expect(results.length).toBe(0);

            array[1].next('item 2');

            // should now have the first template result
            expect(results.length).toBe(1);
            expect(results[0].values.length).toBe(1);
            expect(results[0].values[0]).toEqual(['item 1', 'item 2']);

            // now that all items have a value, updating any item should produce a new template result
            array[1].next('item 2 updated');
            expect(results.length).toBe(2);
            expect(results[1].values.length).toBe(1);
            expect(results[1].values[0]).toEqual(['item 1', 'item 2 updated']);
        });
    });

    describe('given another observable of template result as a value', () => {
        it('should combine templates in rendered html', () => {
            const innerTemplate$ = html`jon guy`;
            const template$ = html`My name is ${innerTemplate$}`;

            subSink.sink = template$.subscribe(result => render(result, document.body));

            expect(document.body.textContent).toBe('My name is jon guy');
        });
    })
});