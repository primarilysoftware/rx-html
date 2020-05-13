import { createState } from './state';
import { isObservable } from 'rxjs';
import { skip } from 'rxjs/operators';
import { SubSink } from 'subsink';

const subSink = new SubSink();
afterEach(() => {
    subSink.unsubscribe();
});

describe('createState', () => {
    describe('returned state', () => {
        it('should be observable', () => {
            const state = createState('test');
            expect(isObservable(state)).toBe(true);
        });

        it('should emit initial value', () => {
            const state = createState('test');
            const values = new Array<string>();

            subSink.sink = state.subscribe(value => values.push(value));

            expect(values.length).toBe(1);
            expect(values[0]).toBe('test');
        });

        it('should be reducable', () => {
            const state = createState('test');
            const values = new Array<string>();

            subSink.sink = state.pipe(
                skip(1) // skip initial value
            ).subscribe(value => values.push(value));

            state.reduce(_ => 'next');

            expect(values.length).toBe(1);
            expect(values[0]).toBe('next');
        });

        describe('select', () => {
            describe('returned state', () => {
                it('should be observable', () => {
                    const nameState$ = createState({
                        first: 'jon',
                        last: 'guy'
                    });

                    const firstNameValues = new Array<string>();
                    const firstNameState$ = nameState$.select('first');
                    subSink.sink = firstNameState$.subscribe(value => firstNameValues.push(value));

                    expect(firstNameValues.length).toBe(1);
                    expect(firstNameValues[0]).toBe('jon');
                });

                it('should be reducable', () => {
                    const nameValues = [];
                    const nameState$ = createState({
                        first: 'jon',
                        last: 'guy'
                    });

                    subSink.sink = nameState$.subscribe(value => nameValues.push(value));

                    const firstNameValues = new Array<string>();
                    const firstNameState$ = nameState$.select('first');
                    subSink.sink = firstNameState$.subscribe(value => firstNameValues.push(value));

                    firstNameState$.reduce(_ => 'updated');

                    expect(nameValues.length).toBe(2);
                    expect(nameValues[0]).toEqual({ first: 'jon', last: 'guy' });
                    expect(nameValues[1]).toEqual({ first: 'updated', last: 'guy' });

                    expect(firstNameValues.length).toBe(2);
                    expect(firstNameValues[0]).toBe('jon');
                    expect(firstNameValues[1]).toBe('updated');
                });

                it('should be selectable', () => {
                    const personValues = [];
                    const personState$ = createState({
                        name: {
                            first: 'jon',
                            last: 'guy'
                        }
                    });

                    subSink.sink = personState$.subscribe(value => personValues.push(value));

                    const lastNameValues = [];
                    const lastNameState$ = personState$.select('name').select('last');
                    subSink.sink = lastNameState$.subscribe(value => lastNameValues.push(value));

                    lastNameState$.reduce(_ => 'updated');

                    expect(personValues.length).toBe(2);
                    expect(personValues[0]).toEqual({ name: { first: 'jon', last: 'guy' } });
                    expect(personValues[1]).toEqual({ name: { first: 'jon', last: 'updated' } });
                    
                    expect(lastNameValues.length).toBe(2);
                    expect(lastNameValues[0]).toEqual('guy');
                    expect(lastNameValues[1]).toEqual('updated');
                });

                it('reduce should not throw when source value is null or undefined', () => {
                    const nameState$ = createState({
                        first: 'jon',
                        last: 'guy'
                    });

                    nameState$.reduce(_ => null);
                    
                    const firstState$ = nameState$.select('first');

                    firstState$.reduce(_ => 'updated');
                });
            });
        });
    });
});