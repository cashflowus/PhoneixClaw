import plugin from 'tailwindcss/plugin.js'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        success: 'hsl(var(--success))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'enter': {
          from: { opacity: 'var(--tw-enter-opacity, 1)', transform: 'translate3d(var(--tw-enter-translate-x, 0), var(--tw-enter-translate-y, 0), 0) scale3d(var(--tw-enter-scale, 1), var(--tw-enter-scale, 1), var(--tw-enter-scale, 1)) rotate(var(--tw-enter-rotate, 0))' },
        },
        'exit': {
          to: { opacity: 'var(--tw-exit-opacity, 1)', transform: 'translate3d(var(--tw-exit-translate-x, 0), var(--tw-exit-translate-y, 0), 0) scale3d(var(--tw-exit-scale, 1), var(--tw-exit-scale, 1), var(--tw-exit-scale, 1)) rotate(var(--tw-exit-rotate, 0))' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'in': 'enter 0.2s ease-out',
        'out': 'exit 0.2s ease-in forwards',
      },
    },
  },
  plugins: [
    plugin(function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          'animate-in': () => ({ animationName: 'enter', animationDuration: theme('animationDuration.DEFAULT', '150ms'), '--tw-enter-opacity': 'initial', '--tw-enter-scale': 'initial', '--tw-enter-translate-x': 'initial', '--tw-enter-translate-y': 'initial', '--tw-enter-rotate': 'initial' }),
          'animate-out': () => ({ animationName: 'exit', animationDuration: theme('animationDuration.DEFAULT', '150ms'), '--tw-exit-opacity': 'initial', '--tw-exit-scale': 'initial', '--tw-exit-translate-x': 'initial', '--tw-exit-translate-y': 'initial', '--tw-exit-rotate': 'initial' }),
        },
        { values: { DEFAULT: '' } },
      )
      matchUtilities({ 'fade-in': (v) => ({ '--tw-enter-opacity': v }), 'fade-out': (v) => ({ '--tw-exit-opacity': v }) }, { values: theme('opacity') })
      matchUtilities({ 'zoom-in': (v) => ({ '--tw-enter-scale': `${parseInt(v) / 100}` }), 'zoom-out': (v) => ({ '--tw-exit-scale': `${parseInt(v) / 100}` }) }, { values: Object.fromEntries(Object.entries(theme('scale')).map(([k, v]) => [k, `${parseFloat(v) * 100}`])) })
      matchUtilities({ 'spin-in': (v) => ({ '--tw-enter-rotate': v }), 'spin-out': (v) => ({ '--tw-exit-rotate': v }) }, { values: theme('rotate') })
      matchUtilities({ 'slide-in-from-top': (v) => ({ '--tw-enter-translate-y': `-${v}` }), 'slide-in-from-bottom': (v) => ({ '--tw-enter-translate-y': v }), 'slide-in-from-left': (v) => ({ '--tw-enter-translate-x': `-${v}` }), 'slide-in-from-right': (v) => ({ '--tw-enter-translate-x': v }) }, { values: theme('translate') })
      matchUtilities({ 'slide-out-to-top': (v) => ({ '--tw-exit-translate-y': `-${v}` }), 'slide-out-to-bottom': (v) => ({ '--tw-exit-translate-y': v }), 'slide-out-to-left': (v) => ({ '--tw-exit-translate-x': `-${v}` }), 'slide-out-to-right': (v) => ({ '--tw-exit-translate-x': v }) }, { values: theme('translate') })
      matchUtilities({ 'animate-duration': (v) => ({ animationDuration: v }) }, { values: theme('transitionDuration') })
      matchUtilities({ 'animate-delay': (v) => ({ animationDelay: v }) }, { values: theme('transitionDelay') })
      matchUtilities({ 'animate-ease': (v) => ({ animationTimingFunction: v }) }, { values: theme('transitionTimingFunction') })
    }),
  ],
}
