import { Link } from 'react-router-dom'

export default function About() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">About Us</p>
          <h1>A New Haven shop with a Bulldog heart</h1>
        </div>
      </section>

      <section className="container section about">
        <div className="about-text">
          <h2>Who we are</h2>
          <p>
            Campus Customs is a local apparel shop at 57 Broadway, a short walk from Old Campus. We run Yale Bulldog
            Blue, our line of officially licensed Yale clothing, and we exist for one reason: to help the Yale
            community show up in blue.
          </p>
          <p>
            Our customers are first-years buying their first sweatshirt, seniors picking out something to remember
            the place by, alumni coming back for reunions, and parents and grandparents who want everyone to know
            where their favorite student goes to school.
          </p>

          <h2>What we make</h2>
          <p>
            Our catalogue goes beyond the classic block YALE hoodie. We carry designs for each residential college,
            for the graduate and professional schools, and for varsity teams across the athletic department, plus
            a family line with pieces for Mom, Dad, Grandpa, Aunt, Uncle, and more.
          </p>
          <p>
            We pick garments that hold up: heavyweight crewnecks, soft tri-blend tees, reverse-weave fleece, and
            quarter-zips you can wear to class or to the Bowl.
          </p>

          <h2>What we believe</h2>
          <ul className="values">
            <li>
              <strong>Authentic.</strong> Official marks, carefully reproduced.
            </li>
            <li>
              <strong>Community first.</strong> Every college, school, and team deserves its own gear.
            </li>
            <li>
              <strong>Made to be worn.</strong> Comfortable pieces you will reach for every week.
            </li>
            <li>
              <strong>Friendly help.</strong> In the shop or online, we are glad to help you find your fit.
            </li>
          </ul>
        </div>

        <aside className="about-card">
          <h3>Visit the shop</h3>
          <p>
            57 Broadway
            <br />
            New Haven, CT 06511
          </p>
          <h3>Shop online</h3>
          <p>Browse the full catalogue, check sizes and stock, and ask our chatbot anything.</p>
          <Link to="/products" className="btn btn-primary">
            Browse products
          </Link>
        </aside>
      </section>
    </>
  )
}
