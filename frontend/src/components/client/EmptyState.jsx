const EmptyState = ({ icon: Icon, title, text, action }) => (
  <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-800">
    {Icon && (
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-400">
        <Icon size={30} />
      </span>
    )}
    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
    {text && <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{text}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default EmptyState;
