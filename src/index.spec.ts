import { Subject, isObservable } from "rxjs";
import { html, createState, mapItems, State } from "./index"
import { take, skip } from "rxjs/operators";

describe('html', () => {
  describe('given no paramters', () => {
    it('should send template result with no values to observers', () => {
      const rxHtml = html`I have no parameters`;
      const observedValues = [];
      rxHtml.subscribe(template => observedValues.push(template));
      
      expect(observedValues.length).toBe(1);
      expect(observedValues[0].values.length).toBe(0);
    });
  });

  describe('given static parameter value', () => {
    it('should send template result with parameter value to observers', () => {
      const testValue = 'test';
      const rxHtml = html`this is a ${testValue}`;
      const observedValues = [];

      rxHtml.subscribe(template => observedValues.push(template));

      expect(observedValues.length).toBe(1);
      expect(observedValues[0].values[0]).toBe(testValue);
    });
  });

  describe('given observable parameter value', () => {
    it('should send template result with new value whenever observable value changes', () => {
      const subject = new Subject<number>();
      const rxHtml = html`Count=${subject}`;
      const observedValues = [];

      rxHtml.subscribe(template => observedValues.push(template));
      expect(observedValues.length).toBe(0);

      subject.next(1);
      expect(observedValues.length).toBe(1);
      expect(observedValues[0].values[0]).toBe(1);
      
      subject.next(2);
      expect(observedValues.length).toBe(2);
      expect(observedValues[1].values[0]).toBe(2);
    });
  });

  describe('given array as parameter', () => {
    it('should send template result with updated array when any item changes', () => {
      const testSubject = new Subject<number>();
      const testItems = [
        'test',
        testSubject,
        false
      ];

      const rxHtml = html`These are some items ${testItems}`;
      const observedValues = [];

      rxHtml.subscribe(val => observedValues.push(val));

      expect(observedValues.length).toBe(0);

      testSubject.next(1);
      expect(observedValues.length).toBe(1);
      expect(Array.isArray(observedValues[0].values[0])).toBe(true);
      expect(observedValues[0].values[0][0]).toBe('test');
      expect(observedValues[0].values[0][1]).toBe(1);
      expect(observedValues[0].values[0][2]).toBe(false);

      testSubject.next(2);
      expect(observedValues.length).toBe(2);
      expect(Array.isArray(observedValues[0].values[0])).toBe(true);
      expect(observedValues[1].values[0][0]).toBe('test');
      expect(observedValues[1].values[0][1]).toBe(2);
      expect(observedValues[1].values[0][2]).toBe(false);
    });
  });
});

describe('createState', () => {
  it('should return an observable', () => {
      const state = createState(1);
      expect(isObservable(state)).toBe(true);
  });

  it('should send initial state to observers', () => {
      const state = createState(1);
      const observedValues = [];
      state.subscribe(val => observedValues.push(val));
      expect(observedValues.length).toBe(1);
      expect(observedValues[0]).toBe(1);
  });

  describe('reduce', () => {
    it('reducer function should receive current value as parameter when called', async () => {
      const state = createState(1);
      await state.reduce(val => {
        expect(val).toBe(1);
        return val + 1;
      });

      await state.reduce(val => {
        expect(val).toBe(2);
        return val + 1;
      });
    });

    it('should send value returned from reducer to observers', async () => {
      const state = createState(1);
      const observedValues = [];

      state.subscribe(val => observedValues.push(val));
      await state.reduce(_ => 2);

      expect(observedValues.length).toBe(2);
      expect(observedValues[0]).toBe(1); //initial state
      expect(observedValues[1]).toBe(2);
    });

    it('should not emit value returned from reducer if value has not changed', done => {
      const state = createState(1);
      state.pipe(
        skip(1), // skip initial value
        take(1)
      ).subscribe(val => {
        // first reduce call will return the current value, so should not
        // trigger this subscription.  second reduce call should trigger
        // this subscription.
        expect(val).toBe(2);
        done();
      });

      state.reduce(val => val);
      state.reduce(val => val + 1);
    });
  });

  describe('select', () => {
    it('should return observable of selected piece of state', () => {
      const state = createState({
        value1: 'test1',
        value2: 'test2'
      });

      const slice = state.select('value1');
      expect(isObservable(slice)).toBe(true);
    });

    it('should send initial selected value to observers', () => {
      const state = createState({
        value1: 'value1-initial',
        value2: 'value2-initial'
      });

      const value1State = state.select('value1');
      const observedValues = [];

      value1State.subscribe(val => observedValues.push(val));

      expect(observedValues.length).toBe(1);
      expect(observedValues[0]).toBe('value1-initial');
    });

    it('should send updated value to observers when selected value is reduced', async () => {
      const state = createState({
        value1: 'value1-initial',
        value2: 'value2-initial'
      });

      const value2State = state.select('value2');
      const observedValues = [];

      value2State.subscribe(val => observedValues.push(val));

      await value2State.reduce(_ => 'value2-updated');

      expect(observedValues.length).toBe(2);
      expect(observedValues[0]).toBe('value2-initial');
      expect(observedValues[1]).toBe('value2-updated');
    });

    it('should not send updated value to observers when selected value is reduced but is still same value', () => {
      const state = createState({
        value1: 'value1-initial',
        value2: 'value2-initial'
      });

      const value1State = state.select('value1');
      const observedValues = [];

      value1State.subscribe(val => observedValues.push(val));

      value1State.reduce(val => val);

      expect(observedValues.length).toBe(1);
      expect(observedValues[0]).toBe('value1-initial');
    });

    it('should send updated value to selected state observers when parent state is reduced', async () => {
      const state = createState({
        value1: 'value1-initial',
        value2: 'value2-initial'
      });

      const value2State = state.select('value2');
      const observedValues = [];
      value2State.subscribe(val => observedValues.push(val));

      await state.reduce(val => ({
        ...val,
        value2: 'value2-updated'
      }));

      expect(observedValues.length).toBe(2);
      expect(observedValues[0]).toBe('value2-initial');
      expect(observedValues[1]).toBe('value2-updated');
    });

    it('should send updated value to parent state observers when selected state is reduced', async () => {
      const state = createState({
        value1: 'value1-initial',
        value2: 'value2-initial'
      });

      const value2State = state.select('value2');
      const observedValues = [];
      state.subscribe(val => observedValues.push(val));

      await value2State.reduce(_ => 'value2-updated');

      expect(observedValues.length).toBe(2);
      expect(observedValues[0].value2).toBe('value2-initial');
      expect(observedValues[1].value2).toBe('value2-updated');
    });

    it('should return state that is itself selectable', () => {
      const state = createState({
        child: {
          value: 'test'
        }
      });

      const childState = state.select('child');
      const valueState = childState.select('value');
      const observedValues = [];
      valueState.subscribe(val => observedValues.push(val));

      expect(observedValues.length).toBe(1);
      expect(observedValues[0]).toBe('test');
    });

    it('reducing nested selected state should send update to parent observers', async () => {
      const parentState = createState({
        child: {
          grandChild: 'grand-child'
        }
      });

      const childState = parentState.select('child');
      const grandChildState = childState.select('grandChild');
      const observedValues = [];

      parentState.subscribe(val => observedValues.push(val));

      await grandChildState.reduce(_ => 'updated');

      expect(observedValues.length).toBe(2);
      expect(observedValues[0].child.grandChild).toBe('grand-child');
      expect(observedValues[1].child.grandChild).toBe('updated');
    });

    it('should not call observer of selected state when sibling state is changed', () => {
      const state = createState({
        target: 'target-initial',
        sibling: 'sibling-initial'
      });

      const targetState = state.select('target');
      const siblingState = state.select('sibling');
      const observedValues = [];

      targetState.subscribe(val => observedValues.push(val));

      // this should not call the targetState observer
      siblingState.reduce(_ => 'sibling-update');

      // observer should only see initial state of target
      expect(observedValues.length).toBe(1);
      expect(observedValues[0]).toBe('target-initial');
    });
  });
});

describe('mapItems', () => {
  it('should make individual items reducable', async () => {
    const itemsState = createState([ 1, 2, 3 ]);
    const itemStates: State<number>[] = [];
    mapItems(itemsState, itemState => itemStates.push(itemState))
      .pipe(take(1))
      .subscribe(() => {
        // just want to force the side effect of pushing itemStates into array
      });

    const observedValues = [];
    itemsState.subscribe(val => observedValues.push(val));

    await itemStates[0].reduce(current => current + 1);

    expect(observedValues.length).toBe(2);
    expect(observedValues[0][0]).toBe(1);
    expect(observedValues[1][0]).toBe(2);
  });

  it('should make individual items selectable', () => {
    const itemsState = createState([ 
      { value: 1 },
      { value: 2 },
      { value: 3 }
    ]);

    const itemStates: State<{ value: number }>[] = [];
    mapItems(itemsState, itemState => itemStates.push(itemState))
      .pipe(take(1))
      .subscribe(() => {
        // just want to force the side effect of pushing itemStates into array
      });

    const observedValues = [];
    itemStates[0].select("value").subscribe(val => {
      observedValues.push(val);
    });

    expect(observedValues.length).toBe(1);
    expect(observedValues[0]).toBe(1);
  });

  it('should not send value returned from reducer to observers if it value has not changed', () => {
    const itemsState = createState([ 1, 2, 3 ]);
    const itemStates: State<number>[] = [];
    mapItems(itemsState, itemState => itemStates.push(itemState))
      .pipe(take(1))
      .subscribe(() => {
        // just want to force the side effect of pushing itemStates into array
      });

    const observedValues = [];
    itemsState.subscribe(val => observedValues.push(val));

    itemStates[0].reduce(current => current);

    expect(observedValues.length).toBe(1);
  });
});