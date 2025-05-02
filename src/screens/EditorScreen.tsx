import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import {
  Canvas,
  Path,
  useCanvasRef,
  SkPath,
  Skia,
  TouchInfo,
  useDrawCallback,
  PaintStyle,
  TouchType,
  SkiaView,
  TouchHandler
} from '@shopify/react-native-skia';
import * as MediaLibrary from 'expo-media-library';

type EditorScreenProps = {
  route: RouteProp<RootStackParamList, 'Editor'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Editor'>;
};

export default function EditorScreen({ route, navigation }: EditorScreenProps) {
  const { imageUri } = route.params;
  const [currentPath, setCurrentPath] = useState<SkPath | null>(null);
  const [paths, setPaths] = useState<SkPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    setIsLoading(false);
  }, []);

  const onDrawingActive: TouchHandler = (touchInfo) => {
    // Handle only single touch for now
    const touch = touchInfo[0][0];
    if (!touch) return;
    
    const { x, y } = touch;
    
    if (touch.type === TouchType.Start) {
      const path = Skia.Path.Make();
      path.moveTo(x, y);
      setCurrentPath(path);
    } else if (touch.type === TouchType.Active && currentPath) {
      currentPath.lineTo(x, y);
      setCurrentPath(currentPath.copy());
    } else if (touch.type === TouchType.End && currentPath) {
      setPaths([...paths, currentPath]);
      setCurrentPath(null);
    }
  };

  const onDraw = useDrawCallback((canvas) => {
    paths.forEach((path) => {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color('red'));
      paint.setStrokeWidth(5);
      paint.setStyle(PaintStyle.Stroke);
      canvas.drawPath(path, paint);
    });

    if (currentPath) {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color('red'));
      paint.setStrokeWidth(5);
      paint.setStyle(PaintStyle.Stroke);
      canvas.drawPath(currentPath, paint);
    }
  }, [paths, currentPath]);

  const saveImage = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need media library permissions to save the image!');
        return;
      }

      // TODO: Implement actual image saving with drawings
      await MediaLibrary.saveToLibraryAsync(imageUri);
      alert('Image saved successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving image:', error);
      alert('Failed to save image');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      <SkiaView style={styles.canvas} onTouch={onDrawingActive}>
        {onDraw}
      </SkiaView>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.button} onPress={saveImage}>
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  canvas: {
    flex: 1,
  },
  toolbar: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 