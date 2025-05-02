import React from 'react';
import { StyleSheet, Text, View, Button, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { enableScreens } from 'react-native-screens';
import * as ImagePicker from 'expo-image-picker';
import { DrawingCanvas } from './components/DrawingCanvas';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

enableScreens();

type RootStackParamList = {
  Home: undefined;
  Editor: {
    imageUri: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen({ navigation }: any) {
  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    // Pick the image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      navigation.navigate('Editor', { imageUri: result.assets[0].uri });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Image Editor</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Select Image from Gallery"
          onPress={pickImage}
        />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

function EditorScreen({ route, navigation }: any) {
  const { imageUri } = route.params;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <DrawingCanvas imageUri={imageUri} style={styles.canvas} />
        <View style={styles.buttonContainer}>
          <Button
            title="Go back"
            onPress={() => navigation.goBack()}
          />
        </View>
        <StatusBar style="auto" />
      </View>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f4511e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#fff',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
        />
        <Stack.Screen 
          name="Editor" 
          component={EditorScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonContainer: {
    marginVertical: 10,
  },
  canvas: {
    width: '100%',
    height: '70%',
    backgroundColor: 'transparent',
  },
}); 