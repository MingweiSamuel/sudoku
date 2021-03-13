function equal(a, b) {
    if (null == a) return null == b;
    const t = typeof a;
    if (t !== typeof b) return false;
    if (t === 'string' || t === 'number' || t === 'boolean') return a === b;
    if (t === 'object') {
        const aKeys = new Set(Object.keys(a));
        const bKeys = Object.keys(b);
        if (aKeys.size !== bKeys.length) return false;
        for (const key of bKeys) {
            if (!aKeys.has(key)) return false;
            if (!equal(a[key], b[key])) return false;
        }
        return true;
    }
    throw Error(`Unknown type for equality check: ${t}.`);
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

function watch(ref, { pattern = '*', onAdd, onRemove, onChange } = {}) {
    let oldData = undefined;
    ref.on('value', snapshot => {
        const newData = snapshot.val();        
        forEachPattern(pattern, oldData, newData, (path, oldVal, newVal) => {
            if (null == oldVal) {
                if (null != newVal) {
                    onAdd && onAdd({ path, newVal });
                }
            }
            else if (null == newVal) {
                onRemove && onRemove({ path, oldVal });
            }
            else if (!equal(oldVal, newVal)) {
                onChange && onChange({ path, oldVal, newVal });
            }
        });
        oldData = newData;
    });
    return () => oldData;
}

function bind(ref, parent, { pattern = '*', create, update }) {
    return watch(ref, {
        pattern,
        onAdd({ path, newVal }) {
            const el = create();
            el.setAttribute('data-path', path.join('.'));
            update(el, path, newVal);
            parent.appendChild(el);
        },
        onRemove({ path, oldVal }) {
            const el = parent.querySelector(`[data-path="${path.join('.')}"]`);
            parent.removeChild(el);
        },
        onChange({ path, oldVal, newVal }) {
            const el = parent.querySelector(`[data-path="${path.join('.')}"]`);
            update(el, path, newVal);
        },
    })
}
