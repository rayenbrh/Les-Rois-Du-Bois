import { Link } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import { withBase, PLACEHOLDER_IMAGE } from '../../utils/imageUrl';

/** Category tile used on the home page and the categories page. */
const CategoryCard = ({ category, compact = false }) => (
  <Link
    to={`/shop/categories/${category._id}`}
    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-card-hover dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gold-300"
  >
    <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 ${compact ? 'aspect-[4/3]' : 'aspect-square'}`}>
      {category.image ? (
        <img
          src={withBase(category.image)}
          alt={category.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-600">
          <FolderOpen size={40} />
        </div>
      )}
    </div>
    <div className="flex flex-1 flex-col p-3 sm:p-4">
      <h3 className="line-clamp-1 text-sm font-bold text-gray-900 transition-colors group-hover:text-gold-700 sm:text-base dark:text-gray-100 dark:group-hover:text-gold-500">
        {category.name}
      </h3>
      {typeof category.productsCount === 'number' && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{category.productsCount} منتج</p>
      )}
      {!compact && category.description && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{category.description}</p>
      )}
    </div>
  </Link>
);

export default CategoryCard;
