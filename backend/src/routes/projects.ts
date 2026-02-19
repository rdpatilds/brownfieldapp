import { Router } from "express";
import { createPaginatedResponse, PaginationParamsSchema } from "@/shared/schemas/pagination";
import { CreateProjectSchema, UpdateProjectSchema } from "@/shared/schemas/projects";
import {
  createProject,
  deleteProject,
  getProject,
  getProjectCount,
  getProjectsByOwner,
  updateProject,
} from "../features/projects";
import { getLogger } from "../logging";
import type { AuthRequest } from "../middleware/auth";

const router = Router();
const logger = getLogger("api.projects");

/**
 * GET /
 * List projects for the authenticated user with pagination.
 */
router.get("/", async (req, res, next) => {
  try {
    const { user } = req as AuthRequest;
    const userId = user.id;

    const searchParams = req.query;
    const paginationResult = PaginationParamsSchema.safeParse({
      page: searchParams["page"] ? Number(searchParams["page"]) : undefined,
      pageSize: searchParams["pageSize"] ? Number(searchParams["pageSize"]) : undefined,
    });

    let pagination: { page: number; pageSize: number };
    if (paginationResult.success) {
      pagination = paginationResult.data;
    } else {
      logger.warn(
        {
          errors: paginationResult.error.flatten(),
          rawPage: searchParams["page"],
          rawPageSize: searchParams["pageSize"],
        },
        "projects.list_invalid_pagination",
      );
      pagination = { page: 1, pageSize: 20 };
    }

    logger.info({ userId, pagination }, "projects.list_started");

    const [projects, total] = await Promise.all([
      getProjectsByOwner(userId),
      getProjectCount(userId),
    ]);

    // Apply pagination in memory
    const start = (pagination.page - 1) * pagination.pageSize;
    const paginatedProjects = projects.slice(start, start + pagination.pageSize);

    logger.info({ userId, count: paginatedProjects.length }, "projects.list_completed");

    res.json(createPaginatedResponse(paginatedProjects, total, pagination));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /
 * Create a new project for the authenticated user.
 */
router.post("/", async (req, res, next) => {
  try {
    const { user } = req as AuthRequest;
    const userId = user.id;
    const input = CreateProjectSchema.parse(req.body);

    logger.info({ userId, name: input.name }, "projects.create_started");

    const project = await createProject(input, userId);

    logger.info({ userId, projectId: project.id }, "projects.create_completed");

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id
 * Get a single project by ID.
 * Returns public projects to anyone, private projects only to owner.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as unknown as AuthRequest).user?.id ?? null;

    logger.info({ projectId: id, userId }, "project.get_started");

    const project = await getProject(id, userId);

    logger.info({ projectId: id }, "project.get_completed");

    res.json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /:id
 * Update a project. Only the owner can update.
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user } = req as unknown as AuthRequest;
    const userId = user.id;
    const input = UpdateProjectSchema.parse(req.body);

    logger.info({ projectId: id, userId }, "project.update_started");

    const project = await updateProject(id, input, userId);

    logger.info({ projectId: id, userId }, "project.update_completed");

    res.json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /:id
 * Delete a project. Only the owner can delete.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user } = req as unknown as AuthRequest;
    const userId = user.id;

    logger.info({ projectId: id, userId }, "project.delete_started");

    await deleteProject(id, userId);

    logger.info({ projectId: id, userId }, "project.delete_completed");

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as projectsRouter };
