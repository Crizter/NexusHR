import JobOpening from "../models/JobOpening.models.js";
import User from "../models/User.models.js";

// --------------POST - /api/jobs---------------------

export const createJobOpening = async (req, res) => {
  try {
    const orgId  = req.user.orgId;
    const userId = req.user.id;

    if (!orgId || !userId) {
      return res.status(404).json({ message: `Not authenticated` });
    }

    const {
      title,
      department,
      location,
      description,
      technologies,
      salaryRange,
      stages,
      screeningQuestions,
    } = req.body;

    // ── Normalise technologies ────────────────────────────────────────────
    // Frontend sends plain strings: ["React", "Node.js"]
    // Schema expects objects:       [{ name, yearsRequired, weight }]
    const formattedTechnologies = (technologies ?? []).map(tech => {
      if (typeof tech === 'string') {
        return { name: tech, yearsRequired: 0, weight: 1 };
      }
      // Already an object (future-proof if frontend ever sends full objects)
      return tech;
    });

    // ── Normalise stages ──────────────────────────────────────────────────
    // Frontend sends plain strings: ["Screening", "Interview", "Offer", "Hired"]
    // Schema expects objects:       [{ name, order }]
    const formattedStages = (stages ?? []).map((stageName, index) => ({
      name:  stageName,
      order: index + 1,
    }));

    const newJob = await JobOpening.create({
      orgId,
      createdBy:          userId,
      title,
      department,
      location,
      description,
      technologies:       formattedTechnologies,   // ← was raw technologies
      salaryRange,
      stages:             formattedStages,
      status:             'Published',
      screeningQuestions,
    });

    return res.status(200).json({
      success: true,
      message: 'Job created successfully',
      job:     newJob,
    });

  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

//  -------------  GET- /api/jobs/public/:orgId

export const getPublicJobOpenings = async (req,res) => { 
    const {orgId} = req.params ; 
    if(!orgId){
        res.status(404).json({message:"Job not found for the organization."});
    }   
    try {
        const jobs = await JobOpening.find({
        orgId,
        status:"Published",
    })
    .select("title department location description technologies salaryRange screeningQuestions createdAt") 
    .lean();
    
    res.status(200).json({
        success: true,
        count: jobs.length,
        data: jobs,
    })
    } catch (error) {
        console.error("Error fetching public jobs:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    }
}


// ─── GET /api/jobs  (protected) ───────────────────────────────────────────────
export const getJobOpenings = async (req, res) => {
  try {
    const jobs = await JobOpening.find({ orgId: req.user.orgId })
      .select('_id title department location status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    console.error('[jobController] getJobOpenings error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};
