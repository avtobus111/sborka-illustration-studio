/* Figma host adapter. Illustration generation stays in the shared UI engine. */
figma.showUI(__html__, { width: 1180, height: 760, themeColors: false, title: 'Сборка — векторная студия' });
figma.ui.onmessage = async function (message) {
  try {
    if (message.type === 'insert') {
      if (typeof message.svg !== 'string' || message.svg.length > 5000000 || /<image|<script|foreignObject/i.test(message.svg)) throw new Error('Некорректный SVG.');
      const frame = figma.createNodeFromSvg(message.svg);
      frame.name = 'Сборка · ' + String(message.title || 'Композиция').slice(0, 100);
      const center = figma.viewport.center;
      frame.x = Math.round(center.x - frame.width / 2);
      frame.y = Math.round(center.y - frame.height / 2);
      figma.currentPage.selection = [frame];
      figma.viewport.scrollAndZoomIntoView([frame]);
      figma.ui.postMessage({ type: 'status', text: 'Композиция добавлена в Figma. Все пути доступны для редактирования.' });
      figma.notify('Композиция добавлена');
    }
    if (message.type === 'export-selection') {
      const selection = figma.currentPage.selection;
      if (selection.length !== 1) throw new Error('Выделите один фрейм или группу на холсте Figma.');
      const svg = await selection[0].exportAsync({ format: 'SVG_STRING', svgIdAttribute: true, svgOutlineText: true });
      figma.ui.postMessage({ type: 'export-result', svg: svg });
      figma.ui.postMessage({ type: 'status', text: 'SVG из выделения Figma подготовлен к скачиванию.' });
    }
  } catch (error) {
    figma.ui.postMessage({ type: 'status', text: error.message || String(error), error: true });
  }
};
