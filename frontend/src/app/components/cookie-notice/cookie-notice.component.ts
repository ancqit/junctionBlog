import { Component, signal } from '@angular/core';

const ACK_KEY = 'junction.cookies.ack';

function acknowledged(): boolean {
  try {
    return localStorage.getItem(ACK_KEY) === '1';
  } catch {
    return false;
  }
}

/** One-time notice that the site keeps session data on this device. */
@Component({
  selector: 'app-cookie-notice',
  template: `
    @if (visible()) {
      <section class="notice" role="region" aria-label="Cookies">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3.5-3A3 3 0 0 1 14 5.5 3 3 0 0 1 12 3Z" />
          <circle cx="8.5" cy="10.5" r="1.1" />
          <circle cx="11" cy="15.5" r="1.1" />
          <circle cx="15.5" cy="14" r="1.1" />
        </svg>
        <p>We keep a little data on this device (cookies and local storage) to keep you signed in. Your session is cleared when you log out or it expires.</p>
        <button type="button" (click)="dismiss()">Got it</button>
      </section>
    }
  `,
  styles: `
    .notice {
      position: fixed;
      left: 50%;
      bottom: max(1rem, env(safe-area-inset-bottom));
      z-index: 45;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      width: min(40rem, calc(100% - 2rem));
      box-sizing: border-box;
      padding: 0.8rem 0.8rem 0.8rem 1rem;
      border: 1px solid rgba(243, 215, 130, 0.35);
      border-radius: 1.1rem;
      background: #194b31;
      color: #fffdf8;
      box-shadow: 0 18px 40px rgba(15, 31, 23, 0.28);
      transform: translateX(-50%);
      animation: notice-in 0.3s ease-out;
    }

    .icon {
      flex: none;
      width: 1.75rem;
      height: 1.75rem;
      fill: none;
      stroke: #f3d782;
      stroke-width: 1.6;
      stroke-linejoin: round;
    }

    .icon circle {
      fill: #f3d782;
      stroke: none;
    }

    p {
      flex: 1;
      margin: 0;
      font-size: 0.84rem;
      line-height: 1.45;
    }

    button {
      flex: none;
      padding: 0.55rem 1rem;
      border: 0;
      border-radius: 999px;
      background: #f3d782;
      color: #194b31;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 800;
      cursor: pointer;
    }

    button:hover {
      background: #f7e9b8;
    }

    button:focus-visible {
      outline: 3px solid #fffdf8;
      outline-offset: 2px;
    }

    @keyframes notice-in {
      from {
        opacity: 0;
        transform: translate(-50%, 0.75rem);
      }
    }

    @media (max-width: 560px) {
      .notice {
        flex-wrap: wrap;
      }

      .icon {
        display: none;
      }

      button {
        width: 100%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .notice {
        animation: none;
      }
    }
  `,
})
export class CookieNoticeComponent {
  readonly visible = signal(!acknowledged());

  dismiss(): void {
    this.visible.set(false);
    try {
      localStorage.setItem(ACK_KEY, '1');
    } catch {
      /* private mode: hidden until the next visit */
    }
  }
}
