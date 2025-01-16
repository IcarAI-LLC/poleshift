// LoadingIcon.jsx
import gif from '../assets/icons/dna.gif';

// Convert the modules object into an array and sort them
function LoadingIcon({ width = 24, height = 24, text = "" }) {

    return (
        <div className="flex flex-col justify-center items-center">
        <img
            src={gif}
            alt="Loading icon frame"
            width = {width}
            height = {height}
        />
            {text.length > 0 ? <div className="flex text-center">{text}</div> : null}
        </div>
    );
}

export default LoadingIcon;