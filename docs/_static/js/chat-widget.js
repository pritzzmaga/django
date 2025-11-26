document.addEventListener("DOMContentLoaded", function() {
    const script = document.createElement("script");
    script.src = "http://localhost:3001/widget.js";
    script.async = true;

    script.setAttribute("data-bot-id", "4");
    script.setAttribute("data-header-title", "Django AI Helper");
    script.setAttribute("data-first-message", "Ask any question about Django over here");

    document.head.appendChild(script);
});
