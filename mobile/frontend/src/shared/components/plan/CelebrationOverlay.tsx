/**
 * CelebrationOverlay — 庆祝花瓣 + 星星动画。对齐 m1-p4.html 设计。
 * 挂载后自动生成花瓣飘落和星星闪烁。使用 CSS 动画（GPU 加速），性能友好。
 */
import { useEffect, useRef } from 'react';

const PETAL_COLORS = ['#D4A574', '#E8A94D', '#C8A951', '#C03A39'];
const SPARKLE_EMOJIS = ['✨', '⭐', '🌟', '💫'];

export function CelebrationOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let stopped = false;

    // ── 花瓣 ──
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
      petal.style.borderRadius = Math.random() > 0.5 ? '150% 0 150% 0' : '0 150% 0 150%';

      const duration = Math.random() * 3 + 2;
      petal.style.animationDuration = `${duration}s`;

      container.appendChild(petal);

      setTimeout(() => {
        petal.remove();
      }, duration * 1000 + 100);
    }

    // ── 星星 ──
    function createSparkle() {
      if (stopped || !container) return;

      const sparkle = document.createElement('div');
      sparkle.className = 'mp-sparkle';
      sparkle.textContent = SPARKLE_EMOJIS[Math.floor(Math.random() * SPARKLE_EMOJIS.length)];
      sparkle.style.left = `${10 + Math.random() * 80}vw`;
      sparkle.style.top = `${10 + Math.random() * 80}vh`;
      sparkle.style.fontSize = `${16 + Math.random() * 20}px`;

      container.appendChild(sparkle);

      setTimeout(() => {
        sparkle.remove();
      }, 1500);
    }

    // 初始大量花瓣
    for (let i = 0; i < 30; i++) {
      setTimeout(createPetal, Math.random() * 1000);
    }

    // 初始星星
    for (let i = 0; i < 20; i++) {
      setTimeout(createSparkle, Math.random() * 800);
    }

    // 持续花瓣
    const petalInterval = setInterval(() => {
      if (container.querySelectorAll('.mp-petal').length < 80) {
        createPetal();
      }
    }, 150);

    // 持续星星
    const sparkleInterval = setInterval(() => {
      if (container.querySelectorAll('.mp-sparkle').length < 15) {
        createSparkle();
      }
    }, 300);

    return () => {
      stopped = true;
      clearInterval(petalInterval);
      clearInterval(sparkleInterval);
      if (container) {
        container.querySelectorAll('.mp-petal, .mp-sparkle').forEach((p) => p.remove());
      }
    };
  }, []);

  return <div ref={containerRef} className="mp-celebration" aria-hidden="true" />;
}
