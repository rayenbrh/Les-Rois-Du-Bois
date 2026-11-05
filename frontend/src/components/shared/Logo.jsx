import { useTheme } from '../../contexts/ThemeContext';
import { Link } from 'react-router-dom';

const Logo = ({ 
  size = 'md', 
  showText = false, 
  to = null,
  className = '',
  clickable = true 
}) => {
  const { isDark } = useTheme();

  // Size mappings
  const sizeMap = {
    sm: 'h-10 w-10',      // 40px
    md: 'h-14 w-14',      // 56px
    lg: 'h-20 w-20',      // 80px
    xl: 'h-28 w-28',      // 112px
  };

  const textSizeMap = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  // Logo image path - different logos for light and dark themes
  const logoPathLight = '/logo-light.webp';
  const logoPathDark = '/logo-dark.webp';
  const logoPathFallback = '/logo.webp'; // Fallback if theme-specific logos don't exist

  // Determine which logo to use - try theme-specific first, then fallback
  const currentLogoPath = isDark ? logoPathDark : logoPathLight;

  // Logo content
  const logoContent = (
    <div className={`flex flex-col items-center ${className}`}>
      <div 
        className={`${sizeMap[size]} relative transition-all duration-300 ${
          clickable && to ? 'cursor-pointer hover:scale-105' : ''
        }`}
        style={{
          filter: isDark 
            ? 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.3))' 
            : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
        }}
      >
        <img
          src={currentLogoPath}
          alt="Les Rois Du Bois Logo"
          className="h-full w-full object-contain relative z-10"
          onError={(e) => {
            // Try the other theme logo first (logo-light.webp or logo-dark.webp)
            if (!e.target.dataset.fallbackTried) {
              e.target.dataset.fallbackTried = 'true';
              e.target.src = isDark ? logoPathLight : logoPathDark;
            } else if (!e.target.dataset.secondFallbackTried) {
              // Try logo.webp as second fallback
              e.target.dataset.secondFallbackTried = 'true';
              e.target.src = logoPathFallback;
            } else {
              // If all fail, show placeholder
              e.target.style.display = 'none';
              const placeholder = e.target.parentElement?.querySelector('.logo-placeholder');
              if (placeholder) placeholder.classList.remove('hidden');
            }
          }}
        />
        {/* Placeholder if image fails to load */}
        <div className="logo-placeholder hidden absolute inset-0 h-full w-full bg-gold-100 dark:bg-gold-900/20 rounded-lg flex items-center justify-center z-0">
          <span className="text-gold-600 dark:text-gold-400 font-bold text-xs">LRDB</span>
        </div>
      </div>
      {showText && (
        <p className={`${textSizeMap[size]} font-bold text-gold-600 dark:text-gold-400 mt-2 text-center break-words`}>
          Les Rois Du Bois
        </p>
      )}
    </div>
  );

  // Wrap in Link if clickable and to is provided
  if (clickable && to) {
    return (
      <Link to={to} className="flex justify-center items-center">
        {logoContent}
      </Link>
    );
  }

  return <div className="flex justify-center items-center w-full">{logoContent}</div>;
};

export default Logo;

