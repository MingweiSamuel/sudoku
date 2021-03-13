function equal(a, b) {
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
            const bKeys = Object.keys(b);
            if (aKeys.size !== bKeys.length) return false;
            for (const key of bKeys) {
                if (!aKeys.has(key)) return false;
                if (!equal(a[key], b[key])) return false;
            }
            return true;
        default:
            throw Error(`Unknown type for equality check: ${t}.`);
    }
}

function combineUpdates(target, updates) {
    outer:
    for (const [ key, val ] of Object.entries(updates)) {
        const path = key.split('/');
        const leaf = path.pop();
        let seg;
        let subpath = '';

        // Find any existing parent paths.
        while (null != (seg = path.shift())) {
            subpath += (subpath ? '/' : '') + seg;
            if (subpath in target) {
                if (null === target[subpath]) target[subpath] = {};
                if ('object' === typeof target[subpath]) {
                    let subtarget = target[subpath];
                    while (null != (seg = path.shift())) {
                        subtarget = (subtarget[seg] || (subtarget[seg] = {}));
                    }
                    subtarget[leaf] = val;
                }
                else {
                    delete target[subpath];
                }
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
}

function applyUpdates(readonlyTarget, updates) {
    const out = JSON.parse(JSON.stringify(readonlyTarget));
    for (const [ key, val ] of Object.entries(updates)) {
        const path = key.split('/');
        const leaf = path.pop();
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

function forEachPattern(pattern, oldData, newData, func, path = []) {
    if ('string' === typeof pattern) {
        pattern = pattern.split('/');
    }
    
    const root = !pattern || !pattern.length;
    if (root) {
        func(path, oldData, newData);
    }
    else if ('*' === pattern[0]) {
        const keys = new Set([
            ...Object.keys(oldData || {}),
            ...Object.keys(newData || {}),
        ]);
        for (const key of keys) {
            path.push(key);
            const oldVal = oldData && oldData[key];
            const newVal = newData && newData[key];
            if (root) {
                func(path, oldVal, newVal);
            }
            else {
                forEachPattern(pattern.slice(1), oldVal, newVal, func, path);
            }
            path.pop();
        }
    }
    else {
        // Note: path is only updated on '*' or root.
        const key = pattern.shift();
        const oldVal = oldData && oldData[key];
        const newVal = newData && newData[key];
        forEachPattern(pattern, oldVal, newVal, func, path);
    }
}

class Watch {
    constructor(ref, delay = 200) {
        this.ref = ref;
        this.data = undefined;
        this._delay = delay;
        this._watchers = {};
        this._updates = null;
        this._updatesInflight = null;

        this.ref.on('value', snapshot => {
            let newData = snapshot.val();

            if (this._updates) {
                newData = applyUpdates(newData, this._updates);
            }
            if (this._updatesInflight) {
                newData = applyUpdates(newData, this._updatesInflight);
            }

            this._onChange(newData);
        });
    }

    watch(pattern, watcher) {
        (this._watchers[pattern] || (this._watchers[pattern] = [])).push(watcher);
    }

    update(updates) {
        // Enqueue updates.
        if (null == this._updates) {
            this._updates = {};
            setTimeout(() => {
                this._updatesInflight = this._updates;
                this._updates = null;
                this.ref.update(this._updatesInflight, (err) => {
                    if (err) console.error('Update Error', err);
                    // else this._updates = null;
                    this._updatesInflight = null;
                });
            }, this._delay);
        }
        combineUpdates(this._updates, updates);

        // Update local model.
        const newData = applyUpdates(this.data, updates);
        this._onChange(newData);
    }

    _onChange(newData) {
        for (const [ pattern, watchers ] of Object.entries(this._watchers)) {
            forEachPattern(pattern, this.data, newData, (path, oldVal, newVal) => {
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
            });
        }
        this.data = newData;
    }
}

function makeBind(parent, { create, update }) {
    return {
        onAdd({ path, newVal }) {
            const el = create();
            el.setAttribute('data-path', path.join('.'));
            update(el, path, newVal);
            parent.appendChild(el);
        },
        onRemove({ path, oldVal }) {
            const el = parent.querySelector(`[data-path="${path.join('.')}"]`);
            if (!el) console.warn(`Failed to find element for path ${path.join('.')}.`);
            else parent.removeChild(el);
        },
        onChange({ path, oldVal, newVal }) {
            const el = parent.querySelector(`[data-path="${path.join('.')}"]`);
            update(el, path, newVal);
        },
    };
}
