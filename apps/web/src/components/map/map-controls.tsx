"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Minus, 
  Navigation, 
  Layers, 
  Maximize,
  Map as MapIcon,
  Box,
  Car,
  Sun,
  Moon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '@/contexts/language-context';

interface MapControlsProps {
  onStyleChange: (style: 'dark' | 'light' | 'satellite') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFlyToUserLocation: () => void;
  onToggle3D?: () => void;
  onToggleTraffic?: () => void;
  currentStyle: 'dark' | 'light' | 'satellite';
  hasUserLocation: boolean;
  is3DEnabled?: boolean;
  isTrafficEnabled?: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onStyleChange,
  onZoomIn,
  onZoomOut,
  onFlyToUserLocation,
  onToggle3D,
  onToggleTraffic,
  currentStyle,
  hasUserLocation,
  is3DEnabled = false,
  isTrafficEnabled = false,
}) => {
  const { t } = useTranslation();
  const isDarkMode = currentStyle === 'dark';
  
  // Cycle through styles: dark -> light -> satellite -> dark
  const handleStyleToggle = () => {
    if (currentStyle === 'dark') {
      onStyleChange('light');
    } else if (currentStyle === 'light') {
      onStyleChange('satellite');
    } else {
      onStyleChange('dark');
    }
  };

  // Get icon and title for current style
  const getStyleInfo = () => {
    switch (currentStyle) {
      case 'dark':
        return { icon: <Moon className="h-4 w-4" />, title: t('map.controls.styleDark') };
      case 'light':
        return { icon: <Sun className="h-4 w-4" />, title: t('map.controls.styleLight') };
      case 'satellite':
        return { icon: <Layers className="h-4 w-4" />, title: t('map.controls.styleSatellite') };
    }
  };

  const styleInfo = getStyleInfo();

  return (
    // Starts below the search bar + category chips (z-20) so zoom stays clickable
    <motion.div 
      className="absolute top-36 right-4 z-10 flex flex-col gap-2 md:top-32"
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      {/* Zoom Controls */}
      <Card className={`${isDarkMode ? 'bg-card/95 border-border' : 'bg-card/95 border-0'} backdrop-blur-md shadow-lg py-0 gap-0`}>
        <CardContent className="p-1 sm:p-1.5">
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomIn}
              className={`h-11 w-11 md:h-9 md:w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-foreground hover:bg-secondary hover:text-foreground' 
                  : 'hover:bg-teal-soft hover:text-primary'
              }`}
              title={t('map.controls.zoomIn')}
              aria-label={t('map.controls.zoomIn')}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <div className={`h-px mx-1.5 ${isDarkMode ? 'bg-muted-foreground' : 'bg-secondary'}`} />
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomOut}
              className={`h-11 w-11 md:h-9 md:w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-foreground hover:bg-secondary hover:text-foreground' 
                  : 'hover:bg-teal-soft hover:text-primary'
              }`}
              title={t('map.controls.zoomOut')}
              aria-label={t('map.controls.zoomOut')}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Style Toggle (Dark/Light/Satellite) */}
      <Card className={`${isDarkMode ? 'bg-card/95 border-border' : 'bg-card/95 border-0'} backdrop-blur-md shadow-lg py-0 gap-0`}>
        <CardContent className="p-1 sm:p-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStyleToggle}
            className={`h-11 w-11 md:h-9 md:w-9 p-0 touch-manipulation rounded-lg transition-colors ${
              currentStyle === 'satellite'
                ? 'bg-teal-soft text-primary hover:bg-teal-soft'
                : isDarkMode
                  ? 'text-foreground hover:bg-secondary hover:text-foreground'
                  : 'hover:bg-teal-soft hover:text-primary'
            }`}
            title={styleInfo.title}
            aria-label={styleInfo.title}
          >
            {styleInfo.icon}
          </Button>
        </CardContent>
      </Card>

      {/* 3D Toggle */}
      {onToggle3D && (
        <Card className={`${isDarkMode ? 'bg-card/95 border-border' : 'bg-card/95 border-0'} backdrop-blur-md shadow-lg py-0 gap-0`}>
          <CardContent className="p-1 sm:p-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle3D}
              className={`h-11 w-11 md:h-9 md:w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                is3DEnabled 
                  ? 'bg-purple-100 text-purple-600 hover:bg-purple-200' 
                  : isDarkMode
                    ? 'text-foreground hover:bg-purple-900/50 hover:text-purple-400'
                    : 'hover:bg-purple-50 hover:text-purple-600'
              }`}
              title={t(is3DEnabled ? 'map.controls.disable3d' : 'map.controls.enable3d')}
              aria-label={t(is3DEnabled ? 'map.controls.disable3d' : 'map.controls.enable3d')}
              aria-pressed={is3DEnabled}
            >
              <Box className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Traffic Toggle */}
      {onToggleTraffic && (
        <Card className={`${isDarkMode ? 'bg-card/95 border-border' : 'bg-card/95 border-0'} backdrop-blur-md shadow-lg py-0 gap-0`}>
          <CardContent className="p-1 sm:p-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleTraffic}
              className={`h-11 w-11 md:h-9 md:w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                isTrafficEnabled 
                  ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' 
                  : isDarkMode
                    ? 'text-foreground hover:bg-orange-900/50 hover:text-orange-400'
                    : 'hover:bg-orange-50 hover:text-orange-600'
              }`}
              title={t(isTrafficEnabled ? 'map.controls.hideTraffic' : 'map.controls.showTraffic')}
              aria-label={t(isTrafficEnabled ? 'map.controls.hideTraffic' : 'map.controls.showTraffic')}
              aria-pressed={isTrafficEnabled}
            >
              <Car className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* User Location */}
      {hasUserLocation && (
        <Card className={`${isDarkMode ? 'bg-card/95 border-border' : 'bg-card/95 border-0'} backdrop-blur-md shadow-lg py-0 gap-0`}>
          <CardContent className="p-1 sm:p-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onFlyToUserLocation}
              className={`h-11 w-11 md:h-9 md:w-9 p-0 touch-manipulation rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-foreground hover:bg-secondary hover:text-foreground' 
                  : 'hover:bg-teal-soft hover:text-primary'
              }`}
              title={t('map.controls.myLocation')}
              aria-label={t('map.controls.myLocation')}
            >
              <Navigation className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Fullscreen Toggle */}
      <Card className={`${isDarkMode ? 'bg-card/95 border-border' : 'bg-card/95 border-0'} backdrop-blur-md shadow-lg py-0 gap-0`}>
        <CardContent className="p-1 sm:p-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className={`h-11 w-11 md:h-9 md:w-9 p-0 touch-manipulation rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-foreground hover:bg-secondary hover:text-foreground' 
                : 'hover:bg-teal-soft hover:text-primary'
            }`}
            title={t('map.controls.fullscreen')}
            aria-label={t('map.controls.fullscreen')}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
