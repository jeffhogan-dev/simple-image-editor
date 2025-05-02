import React, { useState, useRef, useMemo } from 'react';
import { StyleSheet, View, Image, PanResponder, PanResponderGestureState, Dimensions, TouchableOpacity, Text, Alert, ScrollView } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import type { PathProps } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

interface DrawingCanvasProps {
  imageUri: string;
  style?: any;
}

interface DrawPath {
  path: string;
  color: string;
  strokeWidth: number;
  isEraser?: boolean;
  isImageEraser?: boolean;
}

const COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF'];
const BRUSH_SIZES = [2, 4, 6, 8, 10];

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ imageUri, style }) => {
  const [paths, setPaths] = React.useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = React.useState<string>('');
  const [selectedColor, setSelectedColor] = React.useState('#FF0000');
  const [brushSize, setBrushSize] = React.useState(3);
  const [isEraser, setIsEraser] = React.useState(false);
  const [undoStack, setUndoStack] = React.useState<DrawPath[]>([]);
  const [activeToolSection, setActiveToolSection] = React.useState<'none' | 'colors' | 'brushes'>('none');
  const viewShotRef = React.useRef<ViewShot>(null);
  const [imageSize, setImageSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [renderedImageBounds, setRenderedImageBounds] = React.useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  });
  const containerRef = useRef<View>(null);
  const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });

  const onImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    setImageSize({ width, height });
  };

  // Calculate the actual rendered image dimensions based on aspect ratio
  const calculateRenderedImageBounds = React.useCallback(() => {
    if (!imageSize || !containerSize.width || !containerSize.height) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const imageAspectRatio = imageSize.width / imageSize.height;
    const containerAspectRatio = containerSize.width / containerSize.height;
    let renderedWidth, renderedHeight, x, y;

    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider relative to container - fit to width
      renderedWidth = containerSize.width;
      renderedHeight = containerSize.width / imageAspectRatio;
      x = 0;
      y = (containerSize.height - renderedHeight) / 2;
    } else {
      // Image is taller relative to container - fit to height
      renderedHeight = containerSize.height;
      renderedWidth = containerSize.height * imageAspectRatio;
      x = (containerSize.width - renderedWidth) / 2;
      y = 0;
    }
    return { x, y, width: renderedWidth, height: renderedHeight };
  }, [imageSize, containerSize]);

  // Update rendered bounds when container or image size changes
  React.useEffect(() => {
    const bounds = calculateRenderedImageBounds();
    setRenderedImageBounds(bounds);
  }, [containerSize, imageSize, calculateRenderedImageBounds]);

  // Get absolute position of container
  const measureContainer = () => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        setContainerOffset({ x: pageX, y: pageY });
      });
    }
  };

  // Transform page coordinates to image-relative coordinates
  const transformCoordinates = React.useCallback((pageX: number, pageY: number) => {
    const x = pageX - containerOffset.x - renderedImageBounds.x;
    const y = pageY - containerOffset.y - renderedImageBounds.y;
    
    if (x < 0 || x > renderedImageBounds.width || y < 0 || y > renderedImageBounds.height) {
      return null;
    }
    
    return { x, y };
  }, [renderedImageBounds, containerOffset]);

  // Update container position when layout changes
  React.useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      measureContainer();
    }
  }, [containerSize]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          const { pageX, pageY } = event.nativeEvent;
          const point = transformCoordinates(pageX, pageY);
          if (point) {
            setCurrentPath(`M ${point.x} ${point.y}`);
          }
        },
        onPanResponderMove: (event: GestureResponderEvent) => {
          const { pageX, pageY } = event.nativeEvent;
          const point = transformCoordinates(pageX, pageY);
          if (currentPath && point) {
            if (isEraser) {
              // For eraser, update the eraser path
              setCurrentPath((prevPath: string) => `${prevPath} L ${point.x} ${point.y}`);
              
              // Add a new path with solid white color
              setPaths((prevPaths: DrawPath[]) => [...prevPaths, {
                path: currentPath,
                color: '#FFFFFF',
                strokeWidth: brushSize,
                isEraser: true,
                isImageEraser: false
              }]);
            } else {
              setCurrentPath((prevPath: string) => `${prevPath} L ${point.x} ${point.y}`);
            }
          }
        },
        onPanResponderRelease: () => {
          if (currentPath) {
            if (isEraser) {
              // Add the final eraser path with solid white color
              setPaths((prevPaths: DrawPath[]) => [...prevPaths, {
                path: currentPath,
                color: '#FFFFFF',
                strokeWidth: brushSize,
                isEraser: true,
                isImageEraser: false
              }]);
            } else {
              setPaths((prevPaths: DrawPath[]) => [...prevPaths, {
                path: currentPath,
                color: selectedColor,
                strokeWidth: brushSize,
                isEraser: false,
                isImageEraser: false
              }]);
            }
            setCurrentPath('');
            setUndoStack([]);
          }
        },
      }),
    [currentPath, selectedColor, brushSize, isEraser, transformCoordinates]
  );

  const handleClear = () => {
    if (paths.length > 0) {
      // Store current paths in undo stack before clearing
      setUndoStack([...undoStack, ...paths]);
      setPaths([]);
    }
  };

  const handleUndo = () => {
    if (paths.length > 0) {
      const lastPath = paths[paths.length - 1];
      const newPaths = paths.slice(0, -1);
      setPaths(newPaths);
      setUndoStack([...undoStack, lastPath]);
    }
  };

  const handleRedo = () => {
    if (undoStack.length > 0) {
      const pathToRestore = undoStack[undoStack.length - 1];
      const newUndoStack = undoStack.slice(0, -1);
      setPaths([...paths, pathToRestore]);
      setUndoStack(newUndoStack);
    }
  };

  const saveImage = async () => {
    try {
      // Request permissions specifically for photos
      const { status } = await MediaLibrary.requestPermissionsAsync(false);
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to save images to your photo library');
        return;
      }

      // Capture the view
      if (!viewShotRef.current) {
        Alert.alert('Error', 'Unable to capture image');
        return;
      }

      const uri = await captureRef(viewShotRef);
      
      // Save to media library
      await MediaLibrary.saveToLibraryAsync(uri);
      
      Alert.alert(
        'Success',
        'Image saved to gallery!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to save image',
        [{ text: 'OK' }]
      );
    }
  };

  const toggleToolSection = (section: 'colors' | 'brushes') => {
    setActiveToolSection(activeToolSection === section ? 'none' : section);
  };

  return (
    <View style={[styles.container, style]}>
      {/* Top Toolbar */}
      <View style={styles.topToolbar}>
        <TouchableOpacity
          style={[styles.toolButton, paths.length === 0 && styles.disabledButton]}
          onPress={handleClear}
          disabled={paths.length === 0}
        >
          <Text style={styles.toolButtonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, paths.length === 0 && styles.disabledButton]}
          onPress={handleUndo}
          disabled={paths.length === 0}
        >
          <Text style={styles.toolButtonText}>Undo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, undoStack.length === 0 && styles.disabledButton]}
          onPress={handleRedo}
          disabled={undoStack.length === 0}
        >
          <Text style={styles.toolButtonText}>Redo</Text>
        </TouchableOpacity>
      </View>

      <ViewShot ref={viewShotRef} style={styles.canvasContainer}>
        <View 
          ref={containerRef}
          style={styles.imageAndDrawingContainer}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setContainerSize({ width, height });
          }}
        >
          <View style={[styles.imageAndDrawingContainer, {
            overflow: 'hidden',
            position: 'relative'
          }]} {...panResponder.panHandlers}>
            <Image
              source={{ uri: imageUri }}
              style={[styles.image, {
                width: renderedImageBounds.width || '100%',
                height: renderedImageBounds.height || '100%',
                left: renderedImageBounds.x,
                top: renderedImageBounds.y,
                position: 'absolute',
              }]}
              resizeMode="contain"
              onLoad={(event) => {
                const { width, height } = event.nativeEvent.source;
                setImageSize({ width, height });
              }}
            />
            <Svg style={[styles.svgContainer, {
              width: renderedImageBounds.width || '100%',
              height: renderedImageBounds.height || '100%',
              left: renderedImageBounds.x,
              top: renderedImageBounds.y,
              position: 'absolute',
              pointerEvents: 'none'
            }]}>
              {paths.map((path, index) => (
                <Path
                  key={`path-${index}`}
                  d={path.path}
                  stroke={path.color}
                  strokeWidth={path.strokeWidth}
                  fill="none"
                  strokeOpacity={1}
                  opacity={1}
                />
              ))}
              {currentPath && (
                <Path
                  key="current-path"
                  d={currentPath}
                  stroke={isEraser ? '#FFFFFF' : selectedColor}
                  strokeWidth={brushSize}
                  fill="none"
                  opacity={1}
                />
              )}
            </Svg>
          </View>
        </View>
      </ViewShot>

      {/* Bottom Toolbar */}
      <View style={styles.bottomToolbar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.mainToolbar}
          contentContainerStyle={styles.mainToolbarContent}
        >
          {/* Color Tool Button */}
          <TouchableOpacity
            style={[styles.toolButton, activeToolSection === 'colors' && styles.selectedTool]}
            onPress={() => {
              toggleToolSection('colors');
              setIsEraser(false);
            }}
          >
            <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
            <Text style={styles.toolButtonText}>Color</Text>
          </TouchableOpacity>

          {/* Brush Size Tool Button */}
          <TouchableOpacity
            style={[styles.toolButton, activeToolSection === 'brushes' && styles.selectedTool]}
            onPress={() => toggleToolSection('brushes')}
          >
            <View style={[styles.brushPreview, { width: brushSize, height: brushSize }]} />
            <Text style={styles.toolButtonText}>Size</Text>
          </TouchableOpacity>

          {/* Eraser */}
          <TouchableOpacity
            style={[styles.toolButton, isEraser && styles.selectedTool]}
            onPress={() => {
              setIsEraser(!isEraser);
              setActiveToolSection('none');
            }}
          >
            <Text style={styles.toolButtonText}>Eraser</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Expandable Sections */}
        {activeToolSection === 'colors' && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.expandedSection}
            contentContainerStyle={styles.expandedSectionContent}
          >
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorButton,
                  { backgroundColor: color },
                  selectedColor === color && styles.selectedColor,
                ]}
                onPress={() => {
                  setSelectedColor(color);
                  setIsEraser(false);
                  setActiveToolSection('none');
                }}
              />
            ))}
          </ScrollView>
        )}

        {activeToolSection === 'brushes' && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.expandedSection}
            contentContainerStyle={styles.expandedSectionContent}
          >
            {BRUSH_SIZES.map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.brushButton,
                  brushSize === size && styles.selectedBrush,
                ]}
                onPress={() => {
                  setBrushSize(size);
                  setActiveToolSection('none');
                }}
              >
                <View style={[styles.brushPreview, { width: size, height: size }]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity 
        style={styles.saveButton} 
        onPress={saveImage}
      >
        <Text style={styles.saveButtonText}>Save Image</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  canvasContainer: {
    flex: 1,
  },
  imageAndDrawingContainer: {
    flex: 1,
    position: 'relative',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  svgContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  topToolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff30',
  },
  bottomToolbar: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 2,
    borderTopWidth: 1,
    borderTopColor: '#ffffff30',
  },
  mainToolbar: {
    maxHeight: 60,
  },
  mainToolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  expandedSection: {
    maxHeight: 70,
  },
  expandedSectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#ffffff30',
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff20',
    borderRadius: 20,
    minWidth: 70,
    justifyContent: 'center',
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 5,
    borderWidth: 1,
    borderColor: '#ffffff50',
  },
  brushPreview: {
    backgroundColor: '#fff',
    borderRadius: 2,
    marginRight: 5,
  },
  selectedTool: {
    backgroundColor: '#ffffff40',
  },
  disabledButton: {
    opacity: 0.5,
  },
  toolButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffffff50',
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  brushButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBrush: {
    backgroundColor: '#ffffff40',
  },
  saveButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 