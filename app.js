// Demo app. Replace this file with the real app; keep the Unsubbed.app() call shape.
const demo = document.querySelector('#demo');

const kit = Unsubbed.app({
  id: 'demo',
  name: 'Demo',
  accept: '.json,.txt',
  load: (s) => (demo.value = s.text || ''),
  state: () => ({ text: demo.value }),
  importFile: async (file) => {
    const text = await file.text();
    demo.value = file.name.endsWith('.json') ? JSON.parse(text).text : text;
  },
});

demo.oninput = kit.store;
