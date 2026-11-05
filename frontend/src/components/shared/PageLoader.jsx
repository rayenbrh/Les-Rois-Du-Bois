const PageLoader = ({ fullScreen = true, label = 'جاري التحميل...' }) => (
  <div
    className={`flex items-center justify-center ${fullScreen ? 'min-h-[100dvh]' : 'min-h-[50vh]'} bg-transparent`}
    role="status"
    aria-live="polite"
  >
    <div className="flex flex-col items-center gap-3">
      <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-gold-200 border-t-gold-600" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  </div>
);

export default PageLoader;
