import PropTypes from "prop-types";

export const Header = ({ title, subtitle }) => (
  <header>
    <h1>{title}</h1>
    {subtitle && <p className="subtitle">{subtitle}</p>}
  </header>
);

Header.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
};
