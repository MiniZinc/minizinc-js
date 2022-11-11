const scriptSrc = document.currentScript.src;
window.addEventListener('load', async () => {
    try {
        const response = await fetch(
            'https://api.github.com/repos/cyderize/minizinc-js/contents/docs?ref=gh-pages'
        );
        const json = await response.json();
        const channels = ['stable', 'develop'].filter((x) =>
            json.some((i) => i.name === x)
        );
        const versionTag =
            /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.+)?$/;
        const versions = [];
        for (const version of json) {
            const matches = versionTag.exec(version.name);
            if (matches) {
                versions.push({
                    label: version.name,
                    parts: matches.slice(1).map((x) => parseInt(x, 10)),
                });
            }
        }
        versions.sort((a, b) => {
            for (let i = 0; i < 3; i++) {
                const cmp = b.parts[i] - a.parts[i];
                if (cmp !== 0) {
                    return cmp;
                }
            }
            return 0;
        });
        const all = [...channels, ...versions.map((v) => v.label)];
        const rename = {
            stable: 'latest',
            develop: 'edge',
        };
        const select = document.createElement('select');
        for (const item of all) {
            const label = item in rename ? rename[item] : item;
            const option = document.createElement('option');
            option.value = new URL(`docs/${item}/`, scriptSrc).toString();
            option.textContent = label;
            if (window.location.href.startsWith(option.value)) {
                option.selected = true;
            }
            select.appendChild(option);
        }
        select.addEventListener('change', () => {
            window.location.href = select.value;
        });
        const container = document.createElement('span');
        container.style.paddingLeft = '1rem';
        container.style.position = 'relative';
        container.style.zIndex = 2;
        container.appendChild(select);
        const target = document.getElementById('tsd-search');
        target.appendChild(container);
    } catch (e) {
        console.error(e);
    }
});
