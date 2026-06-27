/**
 * CelebrationOverlay — 庆祝花瓣动画。对齐 m1-p4.html 设计。
 * 挂载后自动生成花瓣，持续飘落。使用 CSS 动画（GPU 加速），性能友好。
 */
import { useEffect, useRef } from 'react';

const PETAL_COLORS = ['#D4A574', '#E8A94D', '#C8A951', '#C03A39'];

export function CelebrationOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let stopped = false;

    function createPetal() {
      if (stopped || !container) return;

      const petal = document.createElement('div');
      petal.className = 'mp-petal';

      const size = Math.random() * 10 + 5;
      petal.style.width = `${size}px`;
      petal.style.height = `${size * 1.5}px`;
      petal.style.left = `${Math.random() * 100}vw`;
      petal.style.backgroundColor =
        PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];

      const duration = Math.random() * 3 + 2;
      petal.style.animationDuration = `${duration}s`;

      container.appendChild(petal);

      setTimeout(() => {
        petal.remove();
      }, duration * 1000 + 100);
    }

    // 初始喷发 30 片
    for (let i = 0; i < 30; i++) {
      setTimeout(createPetal, Math.random() * 1000);
    }

    // 持续生成
    const interval = setInterval(createPetal, 200);

    return () => {
      stopped = true;
      clearInterval(interval);
      if (container) {
        container.querySelectorAll('.mp-petal').forEach((p) => p.remove());
      }
    };
  }, []);

  return <div ref={containerRef} className="mp-celebration" aria-hidden="true" />;
}
