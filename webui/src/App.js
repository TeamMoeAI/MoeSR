import './App.css';
import Navbar from './Components/Navbar';
import InferenceUI from './Components/InferenceUI';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import BackGround from './Components/Background';
import { useState } from 'react';
import Help from './Components/Help';
import About from './Components/About';
const theme = createTheme({
  typography: {
    fontFamily: 'NotoSerifSC, Arial',
    fontSize: 13.5,
  },
  palette: {
    inferui: {
      main: '#666'
    },
    lightBlue: {
      main: '#7ecef4',
      light: '#98d6f4',
      dark: '#67c6f3'
    },
    lightPink: {
      main: '#ea68a2'
    },
    lightGreen: {
      main: '#a2db86'
    }
  }
  // components: {
  //   MuiCssBaseline: {
  //     styleOverrides: `
  //       @font-face {
  //         font-family: "NotoSerifSC";
  //         src: url('../public/NotoSerifSC-Regular-subset.woff2') format('woff2');
  //       }
  //     `,
  //   },
  // },
});

function App() {
  const [navigation, setNavigation] = useState('real-esrgan');

  var content;
  // real-esrgan or real-hatgan
  if ((navigation === 'real-esrgan') || (navigation === 'real-hatgan')) {
    content = <InferenceUI algoName={navigation}></InferenceUI>
  }
  else if (navigation === 'settings') {
    content = <p>Todo...</p>
  }
  else if (navigation === 'help') {
    content = <Help></Help>
  }
  else if (navigation === 'about') {
    content = <About></About>
  }
  console.log(navigation)
  return (
    <div className="App">
      <ThemeProvider theme={theme}>
        <BackGround></BackGround>
        <Navbar setNavigation={setNavigation}></Navbar>
        {content}
      </ThemeProvider>
    </div>

  );
}

export default App;
