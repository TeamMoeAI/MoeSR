import './About.css'

function About({texts}){
    return ( 
    <div className="AboutContainer">
        <p>Github: <a href="/#">https://github.com/TeamMoeAI/MoeSR</a></p>
        <p>{texts.updateNotification}</p>
    </div> );
}
 
export default About;