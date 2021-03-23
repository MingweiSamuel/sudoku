import type firebase from "firebase/app";

export type Data = null | undefined | string | number | boolean | object;
export type Update = Record<string, Data>;
export type Diff = { forward: Update, back: Update };

function equal(a: Data, b: Data): boolean {
    if (null == a) return null == b;
    const t = typeof a;
    if (t !== typeof b) return false;
    switch (t) {
        case 'string':
        case 'number':
        case 'boolean':
            return a === b;
        case 'object':
            const aKeys = new Set(Object.keys(a));
            const bKeys = Object.keys(b as object);
            if (aKeys.size !== bKeys.length) return false;
            for (const key of bKeys) {
                if (!aKeys.has(key)) return false;
                if (!equal((a as any)[key], (b as any)[key] as Data)) return false;
            }
            return true;
        default:
            throw Error(`Unknown type for equality check: ${t}.`);
    }
}

function combineUpdates(readonlyTarget: Update, update: Update): Update {
    const target = readonlyTarget && JSON.parse(JSON.stringify(readonlyTarget)) || {};
    outer:
    for (const [ key, val ] of Object.entries(update)) {
        const path = key.split('/');
        const leaf = path.pop()!;
        let seg: string | undefined;
        let subpath = '';

        // Find any existing parent paths.
        while (null != (seg = path.shift())) {
            subpath += (subpath ? '/' : '') + seg;
            if (subpath in target) {
                if ('object' !== typeof target[subpath]) target[subpath] = {};

                let subtarget = target[subpath];
                while (null != (seg = path.shift())) {
                    subtarget = (subtarget[seg] || (subtarget[seg] = {}));
                }
                subtarget[leaf] = val;
                continue outer;
            }
        }

        // Otherwise delete any existing prefix/child paths.
        for (const targetKey of Object.keys(target)) {
            if (0 === targetKey.indexOf(key) && '/' === targetKey[key.length]) {
                delete target[targetKey];
            }
        }

        // And just apply normally.
        target[key] = val;
    }
    return target;
}

function applyUpdate(readonlyDataTarget: Data, update: Update): Data {
    const out = readonlyDataTarget && JSON.parse(JSON.stringify(readonlyDataTarget)) || {};
    for (const [ key, val ] of Object.entries(update)) {
        const path = key.split('/');
        const leaf = path.pop()!;
        let target = out;
        for (const seg of path) {
            target = target[seg] || (target[seg] = {});
        }
        if (null === val) {
            delete target[leaf]
        }
        else {
            target[leaf] = val;
        }
    }
    return out;
}

function diffUpdate(readonlyDataTarget: Data, update: Update): Diff {
    const forward: Update = {};
    const back: Update = {};
    for (const [ key, val ] of Object.entries(update)) {
        const path = key.split('/');
        let oldVal = readonlyDataTarget;
        for (const seg of path) {
            oldVal = oldVal && (oldVal as any)[seg];
        }

        // Pure add.
        if (null == oldVal) {
            if (null == val) continue; // Short circuit nothing delete.

            forward[key] = val; // Forward: add.
            back[key] = null; // Back: remove.
        }
        // Pure remove.
        else if (null == val) {
            forward[key] = null; // Forward: remove.
            back[key] = oldVal; // Back: add.
        }
        // Change.
        else if (!equal(oldVal, val)) {
            forward[key] = val;
            back[key] = oldVal;
        }
    }

    return { forward, back };
}

function forEachPattern(
    pattern: string | string[],
    oldData: Data,
    newData: Data,
    func: (path: string[], oldVal: Data, newVal: Data) => void,
    _path: string[] = []
): void
{
    if ('string' === typeof pattern) {
        pattern = pattern.split('/');
    }
    
    const root = !pattern || !pattern.length;
    if (root) {
        func(_path, oldData, newData);
    }
    else if ('*' === pattern[0]) {
        const keys = new Set([
            ...Object.keys(oldData || {}),
            ...Object.keys(newData || {}),
        ]);
        for (const key of keys) {
            _path.push(key);
            const oldVal: Data = oldData && (oldData as any)[key];
            const newVal: Data = newData && (newData as any)[key];
            if (root) {
                func(_path, oldVal, newVal);
            }
            else {
                forEachPattern(pattern.slice(1), oldVal, newVal, func, _path);
            }
            _path.pop();
        }
    }
    else {
        // Note: path is only updated on '*' or root.
        const key = pattern.shift()!;
        const oldVal: Data = oldData && (oldData as any)[key];
        const newVal: Data = newData && (newData as any)[key];
        forEachPattern(pattern, oldVal, newVal, func, _path);
    }
}

export interface Watcher {
    onAdd?(arg: { path: string[], newVal: Data }): void;
    onRemove?(arg: { path: string[], oldVal: Data }): void;
    onChange?(arg: { path: string[], oldVal: Data, newVal: Data }): void;
}

export class DataLayer {
    readonly ref: firebase.database.Reference;
    private _data: Data;
    private _delay: number;
    private _watchers: Record<string, Watcher[]>;
    private _updates: null | Update;
    private _updatesInflight: null | Update; 

    constructor(ref: firebase.database.Reference, delay = 250) {
        this.ref = ref;
        this._data = undefined;
        this._delay = delay;
        this._watchers = {};
        this._updates = null;
        this._updatesInflight = null;

        this.ref.on('value', snapshot => {
            let newData = snapshot.val();

            if (this._updatesInflight) {
                newData = applyUpdate(newData, this._updatesInflight);
            }
            if (this._updates) {
                newData = applyUpdate(newData, this._updates);
            }

            this._onChange(newData);
        });
    }

    get<T>(...path: string[]): T | undefined {
        let target = this._data;
        while (target && path.length) target = (target as any)[path.shift()!];
        return target as unknown as T;
    }

    update(update: Update): null | Diff {
        const { forward, back } = diffUpdate(this._data, update);
        if (0 === Object.keys(forward).length)
            return null;

        // Enqueue updates.
        if (null == this._updates) {
            this._updates = {};
            setTimeout(() => {
                if (null == this._updates) return;
                this.ref.update(this._updates, e => {
                    // TODO?
                    if (e) console.error('Update error!', e);
                    this._updatesInflight = null;
                });
                this._updatesInflight = this._updates;
                this._updates = null;
            }, this._delay);
        }
        this._updates = combineUpdates(this._updates, forward);

        // Update local model.
        const newData = applyUpdate(this._data, forward);


        this._onChange(newData);

        return { forward, back };
    }

    watch(pattern: string, watcher: Watcher): void {
        (this._watchers[pattern] || (this._watchers[pattern] = [])).push(watcher);
        forEachPattern(
            pattern, null, this._data,
            (path, oldVal, newVal) => this._runWatchers([ watcher ], path, oldVal, newVal));
    }

    private _onChange(newData: Data): void {
        for (const [ pattern, watchers ] of Object.entries(this._watchers)) {
            forEachPattern(
                pattern, this._data, newData,
                (path, oldVal, newVal) => this._runWatchers(watchers, path, oldVal, newVal));
        }
        this._data = newData;
    }

    private _runWatchers(watchers: Watcher[], path: string[], oldVal: Data, newVal: Data): void {
        if (null == oldVal) {
            if (null != newVal) {
                watchers.forEach(({ onAdd }) =>
                    onAdd && onAdd({ path, newVal }));
            }
        }
        else if (null == newVal) {
            watchers.forEach(({ onRemove }) =>
                onRemove && onRemove({ path, oldVal }));
        }
        else if (!equal(oldVal, newVal)) {
            watchers.forEach(({ onChange }) =>
                onChange && onChange({ path, oldVal, newVal }));
        }
    }
}

interface Bind<T extends Element> {
    create(path: string[]): T;
    update?(el: T, path: string[], newVal: unknown): void;
}

export function makeBind<T extends Element>(parent: Element, { create, update = undefined }: Bind<T>): Watcher {
    return {
        onAdd({ path, newVal }) {
            const el = create(path);
            el.setAttribute('data-path', path.join('.'));
            update && update(el, path, newVal);
            parent.appendChild(el);
        },
        onRemove({ path, oldVal: _ }) {
            const el = parent.querySelector(`[data-path="${path.join('.')}"]`) as T;
            if (!el) console.warn(`Failed to find element for path ${path.join('.')}.`);
            else parent.removeChild(el);
        },
        onChange({ path, oldVal: _, newVal }) {
            const el = parent.querySelector(`[data-path="${path.join('.')}"]`) as T;
            update && update(el, path, newVal);
        },
    };
}
