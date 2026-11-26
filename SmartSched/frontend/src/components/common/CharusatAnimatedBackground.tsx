/** Subtle architectural backdrop for CHARUSAT SmartSched — keeps data tables & grids crisp. */
export function CharusatAnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none"
    >
      {/* Top-left subtle institutional navy radial wash */}
      <div
        className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-3xl opacity-45 dark:opacity-25"
        style={{
          background: 'radial-gradient(circle, rgba(15, 61, 130, 0.14) 0%, transparent 70%)',
        }}
      />
      {/* Bottom-right subtle academic amber/teal wash */}
      <div
        className="absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full blur-3xl opacity-40 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(14, 116, 144, 0.12) 0%, transparent 70%)',
        }}
      />
      {/* Subtle architectural dot grid */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(100, 116, 139, 0.18) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
    </div>
  );
}
