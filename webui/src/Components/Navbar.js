import './Navbar.css'

function Navbar({setNavigation}) {
    return (
        <div className="placeholder">
            <div className="navbar">
                {/* <div className="AppTitle">
                    <img src="icon.png" alt="icon" />
                    <p>MoeSR</p>
                </div> */}

                <ul>
                    <li><a href="/#" onClick={() => setNavigation('real-esrgan')}>Real-ESRGAN</a></li>
                    <li><a href="/#" onClick={() => setNavigation('real-hatgan')}>Real-HATGAN</a></li>
                    <li><a href="/#" onClick={() => setNavigation('settings')}>Settings</a></li>
                    <li><a href="/#" onClick={() => setNavigation('help')}>Help</a></li>
                    <li><a href="/#" onClick={() => setNavigation('about')}>About</a></li>
                </ul>
            </div>
        </div>
    );
}

export default Navbar;