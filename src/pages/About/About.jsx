import "./About.css";

// NOTE: Replace the placeholder links below with your real Instagram/GitHub/LinkedIn
// profile URLs and LinkedIn photo links. We kept all members uniform: Full Stack
// Developer • B.Tech CSE (Semester 7) at Karnavati University.
const team = [
  {
    name: "Shreemad Kumbhani",
    role: "Full Stack Developer",
    headline: "",
    location: "",
    bio: "",
    email: "",
    phone: "",
    eduLeft: { title: "Karnavati University", sub: "B.Tech CSE • Semester 7" },
    eduRight: { title: "", sub: "" },
    avatar: "", // paste LinkedIn photo URL here
    socials: {
      ig: "",
      gh: "",
      li: "https://www.linkedin.com/in/shreemad-kumbhani?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app",
    },
  },
  {
    name: "Ronit Parekh",
    role: "Full Stack Developer",
    headline: "",
    location: "",
    bio: "",
    email: "",
    phone: "",
    eduLeft: { title: "Karnavati University", sub: "B.Tech CSE • Semester 7" },
    eduRight: { title: "", sub: "" },
    avatar: "", // paste LinkedIn photo URL here
    socials: {
      ig: "",
      gh: "",
      li: "https://www.linkedin.com/in/ronit-parekh-8a619a257",
    },
  },
  {
    name: "Het Keshariya",
    role: "Full Stack Developer",
    headline: "",
    location: "",
    bio: "",
    email: "",
    phone: "",
    eduLeft: { title: "Karnavati University", sub: "B.Tech CSE • Semester 7" },
    eduRight: { title: "", sub: "" },
    avatar: "", // paste LinkedIn photo URL here
    socials: {
      ig: "",
      gh: "",
      li: "",
    },
  },
];

export default function About() {
  return (
    <div className="about">
      <div className="container">
        <h1 className="title">About Us</h1>
        <p className="subtitle">
          We are a small team building ParkEasy to make city parking
          stress-free. Our mission is simple: help you find, book, and navigate
          to parking in seconds.
        </p>

        <div className="grid">
          {team.map((m) => (
            <MemberCard key={m.name} {...m} />
          ))}
        </div>

        <section className="values">
          <h2>Our Values</h2>
          <ul>
            <li>
              <strong>User-first:</strong> We obsess over clear, fast flows and
              useful details.
            </li>
            <li>
              <strong>Reliable:</strong> If it says available, you can count on
              it.
            </li>
            <li>
              <strong>Open:</strong> We build with open maps and open standards
              where possible.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function MemberCard({
  name,
  role,
  headline,
  location,
  bio,
  email,
  phone,
  eduLeft,
  eduRight,
  avatar,
  socials,
}) {
  return (
    <div className="member">
      <div className="member-body">
        <div className="member-top">
          <div
            className="avatar"
            style={{
              backgroundImage: `url(${avatar || fallbackAvatar(name)})`,
            }}
          />
          <div className="info">
            <div className="row">
              <div className="col">
                <div className="label">Information</div>
              </div>
            </div>
            <div className="row two">
              <div className="col">
                <div className="label small">Email</div>
                <div className="value">
                  {email ? <a href={`mailto:${email}`}>{email}</a> : "—"}
                </div>
              </div>
              <div className="col">
                <div className="label small">Phone</div>
                <div className="value">
                  {phone ? <a href={`tel:${phone}`}>{phone}</a> : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="names">
          <div>
            <div className="member-name">{name}</div>
            <div className="member-role">{role}</div>
            {(headline || location) && (
              <div className="subline">
                {headline}
                {headline && location ? " • " : ""}
                {location}
              </div>
            )}
          </div>
        </div>

        <div className="edu">
          <div className="label center">Education</div>
          <div className="row two">
            <div className="col">
              <div className="value bold">{eduLeft.title || "—"}</div>
              <div className="muted">{eduLeft.sub || ""}</div>
            </div>
            <div className="col">
              <div className="value bold">{eduRight.title || "—"}</div>
              <div className="muted">{eduRight.sub || ""}</div>
            </div>
          </div>
        </div>

        {bio && <div className="bio">{bio}</div>}
      </div>

      <div className="socials">
        <a
          href={socials.ig || "#"}
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
          title="Instagram"
        >
          <InstagramIcon />
        </a>
        <a
          href={socials.gh || "#"}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          title="GitHub"
        >
          <GitHubIcon />
        </a>
        <a
          href={socials.li || "#"}
          target="_blank"
          rel="noreferrer"
          aria-label="LinkedIn"
          title="LinkedIn"
        >
          <LinkedInIcon />
        </a>
      </div>
    </div>
  );
}

function fallbackAvatar(name) {
  // Simple initials-based avatar fallback using ui-avatars
  const n = encodeURIComponent(name || "P E");
  return `https://ui-avatars.com/api/?name=${n}&background=111&color=fff&size=128&bold=true`;
}

function InstagramIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="#E1306C"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm0 2h10c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3zm11 1a1 1 0 100 2 1 1 0 000-2zM12 7a5 5 0 100 10 5 5 0 000-10z" />
    </svg>
  );
}
function GitHubIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="#fff"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .5C5.73.5.98 5.24.98 11.5c0 4.85 3.15 8.96 7.52 10.41.55.1.75-.24.75-.53v-1.86c-3.06.67-3.7-1.32-3.7-1.32-.5-1.27-1.22-1.6-1.22-1.6-.99-.68.07-.67.07-.67 1.1.08 1.68 1.13 1.68 1.13.97 1.65 2.54 1.17 3.16.9.1-.7.38-1.17.69-1.44-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.41.11-2.94 0 0 .92-.3 3.02 1.13.88-.24 1.83-.36 2.77-.37.94.01 1.88.13 2.76.37 2.1-1.43 3.01-1.13 3.01-1.13.6 1.53.22 2.66.11 2.94.7.77 1.12 1.75 1.12 2.95 0 4.22-2.58 5.14-5.03 5.41.39.34.75 1.02.75 2.06v3.05c0 .29.2.64.76.53A10.99 10.99 0 0023 11.5C23 5.24 18.27.5 12 .5z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="#0A66C2"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V24h-4zM8 8h3.8v2.2h.06c.53-1 1.84-2.2 3.79-2.2 4.05 0 4.8 2.66 4.8 6.1V24h-4v-7.1c0-1.7-.03-3.9-2.38-3.9-2.38 0-2.75 1.86-2.75 3.78V24h-4V8z" />
    </svg>
  );
}
