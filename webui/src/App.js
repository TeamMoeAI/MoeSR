import './App.css';
import Navbar from './Components/Navbar';
import InferenceUI from './Components/InferenceUI';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import BackGround from './Components/Background';
import { useState, useEffect } from 'react';
import Help from './Components/Help';
import About from './Components/About';
import Settings from './Components/Settings';
import translations from './Language';
var webDevMode = false;
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
async function getSettings(webDevMode) {
  if (webDevMode) {
      let dummyData = {'language':'English'}
      return dummyData
  }
  else {
      return await window.eel.py_get_settings()()
  }
}
function App() {
  const [navigation, setNavigation] = useState('real-esrgan');
  const [lang,SetLang] = useState('English');
  const langMap = {'English':'en','简体中文':'zh'};
  useEffect(() => {
    getSettings(webDevMode).then(result => { SetLang(result['language']) })
    console.log('Effect run ' + lang)
  }, []);// eslint-disable-line
  if (!(lang in langMap)){
    SetLang('English')
  }
  const texts = translations[langMap[lang]]
  var content;
  // real-esrgan or real-hatgan
  if ((navigation === 'real-esrgan') || (navigation === 'real-hatgan')) {
    content = <InferenceUI algoName={navigation} webDevMode={webDevMode} texts={texts}></InferenceUI>
  }
  else if (navigation === 'settings') {
    content = <Settings langSetter={SetLang} webDevMode={webDevMode} language={lang}></Settings>
  }
  else if (navigation === 'help') {
    content = <Help language={lang}></Help>
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
